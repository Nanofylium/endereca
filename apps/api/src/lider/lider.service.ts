import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErroAcesso } from '../auth/acesso.service';
import { bloqueadoAte, LIMITE_FALHAS_MATRICULA, Tentativa } from '../auth/bloqueio';
import { filtroEquipe, podeGerir } from '../auth/escopo';
import { Colaborador, Papel, SessaoAtual } from '../auth/tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CONFIG, Config } from '../config';
import { DbService } from '../db/db.service';
import { calcularIndicadores, hojeNaLoja, Indicadores } from '../produtos/indicadores';
import { emitirCodigo } from './emitir-codigo';

export type Situacao = 'ativo' | 'pendente' | 'bloqueado';

export interface MembroEquipe {
  matricula: string;
  nome: string;
  papel: Papel;
  setor: string | null;
  situacao: Situacao;
  ultimoAcesso: Date | null;
  codigoValidoAte: Date | null;
  podeLiberar: boolean;
}

export interface ProdutoEmAlerta {
  sku: string;
  nome: string;
  departamento: string;
  enderecoVenda: string | null;
  diasSemVenda: number | null;
  previsao: Indicadores['previsao'];
}

@Injectable()
export class LiderService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Equipe visível para quem está no painel, com a situação de acesso de cada pessoa. */
  async equipe(sessao: SessaoAtual): Promise<MembroEquipe[]> {
    const filtro = filtroEquipe(sessao, 'c', 1);
    const linhas = await this.db.query<Colaborador & { ultimo_acesso: Date | null; codigo_valido_ate: Date | null }>(
      `SELECT c.*,
              (SELECT max(t.criado_em) FROM tentativas_acesso t WHERE t.matricula = c.matricula AND t.sucesso) AS ultimo_acesso,
              (SELECT max(k.expira_em) FROM codigos_ativacao k WHERE k.matricula = c.matricula AND k.usado_em IS NULL AND k.expira_em > now()) AS codigo_valido_ate
       FROM colaboradores c
       WHERE c.ativo_no_rh AND ${filtro.sql}
       ORDER BY c.setor NULLS LAST, c.nome`,
      filtro.params,
    );

    const tentativas = await this.db.query<Tentativa & { matricula: string }>(
      `SELECT matricula, sucesso, criado_em FROM tentativas_acesso
       WHERE matricula = ANY($1) AND criado_em > now() - interval '1 day'
       ORDER BY criado_em DESC`,
      [linhas.map((l) => l.matricula)],
    );
    const porMatricula = new Map<string, Tentativa[]>();
    for (const t of tentativas) porMatricula.set(t.matricula, [...(porMatricula.get(t.matricula) ?? []), t]);

    const agora = new Date();
    return linhas.map((c) => ({
      matricula: c.matricula,
      nome: c.nome,
      papel: c.papel,
      setor: c.setor,
      situacao: bloqueadoAte(porMatricula.get(c.matricula) ?? [], LIMITE_FALHAS_MATRICULA, agora)
        ? 'bloqueado'
        : c.palavra_hash
          ? 'ativo'
          : 'pendente',
      ultimoAcesso: c.ultimo_acesso,
      codigoValidoAte: c.codigo_valido_ate,
      podeLiberar: !c.palavra_hash && podeGerir(sessao, c),
    }));
  }

  /** Quem veio do RH e ainda não ativou, entre as pessoas que esta sessão pode liberar. */
  async pendentes(sessao: SessaoAtual): Promise<MembroEquipe[]> {
    return (await this.equipe(sessao)).filter((m) => m.situacao === 'pendente' && m.podeLiberar);
  }

  /**
   * Gera o código de primeiro acesso. Ele é mostrado uma única vez, para ser entregue em mãos;
   * o banco guarda só o HMAC. Gerar um novo invalida os anteriores.
   */
  async gerarCodigo(sessao: SessaoAtual, matricula: string): Promise<{ matricula: string; nome: string; codigo: string; expiraEm: Date }> {
    const [colaborador] = await this.db.query<Colaborador>('SELECT * FROM colaboradores WHERE matricula = $1', [matricula]);
    if (!colaborador || !colaborador.ativo_no_rh || colaborador.loja_id !== sessao.loja) {
      throw new ErroAcesso(HttpStatus.NOT_FOUND, 'matricula_inexistente', 'Matrícula não encontrada no cadastro do RH desta loja.');
    }
    if (colaborador.palavra_hash) {
      throw new ErroAcesso(HttpStatus.CONFLICT, 'ja_ativado', 'Esta matrícula já está ativa.');
    }
    if (colaborador.matricula === sessao.sub) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'auto_ativacao', 'Peça o seu código ao seu gestor.');
    }
    if (!podeGerir(sessao, colaborador)) {
      throw new ErroAcesso(
        HttpStatus.FORBIDDEN,
        'sem_permissao',
        sessao.papel === 'lider'
          ? 'Você só libera repositores do seu setor. Para líderes ou outros setores, fale com o gerente operacional.'
          : 'Só um administrador libera o acesso de gerentes.',
      );
    }

    const { codigo, expiraEm } = await this.db.transacao(async (cliente) => {
      const emitido = await emitirCodigo(cliente, matricula, sessao.sub, this.config.jwtSecret);
      await this.auditoria.registrar(
        { autor: sessao.sub, acao: 'codigo_ativacao.gerado', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { matricula } },
        cliente,
      );
      return emitido;
    });
    return { matricula, nome: colaborador.nome, codigo, expiraEm };
  }

  async tentativasRecusadas(sessao: SessaoAtual, desde: Date) {
    return this.db.query<{ matricula: string; aparelho_id: string | null; tipo: string; motivo: string; criado_em: Date }>(
      `SELECT matricula, aparelho_id, tipo, motivo, criado_em
       FROM tentativas_acesso
       WHERE NOT sucesso AND criado_em >= $2
         AND (loja_id = $1 OR matricula IN (SELECT matricula FROM colaboradores WHERE loja_id = $1))
       ORDER BY criado_em DESC
       LIMIT 200`,
      [sessao.loja, desde],
    );
  }

  async avisos(sessao: SessaoAtual) {
    return this.db.query<{ id: string; tipo: string; texto: string; criado_em: Date }>(
      'SELECT id, tipo, texto, criado_em FROM avisos_lider WHERE loja_id = $1 ORDER BY criado_em DESC LIMIT 50',
      [sessao.loja],
    );
  }

  /**
   * Produtos parados ou prestes a faltar na gôndola. O líder vê o departamento com o mesmo nome do seu setor;
   * gerente e administrador veem a loja toda.
   */
  async produtosEmAlerta(sessao: SessaoAtual): Promise<ProdutoEmAlerta[]> {
    const hoje = hojeNaLoja();
    const somenteSetor = sessao.papel === 'lider';
    const produtos = await this.db.query<{
      sku: string;
      nome: string;
      departamento: string;
      endereco_venda: string | null;
      gondola: number | null;
      ultima_venda: string | null;
      vendas: { dia: string; unidades: number }[] | null;
    }>(
      `SELECT p.sku, p.nome, p.departamento,
              (SELECT e.rua || coalesce(' · Módulo ' || e.modulo, '') FROM enderecos_produto e
                WHERE e.sku = p.sku AND e.loja_id = $1 AND e.tipo = 'venda' ORDER BY e.principal DESC LIMIT 1) AS endereco_venda,
              (SELECT sum(e.quantidade)::int FROM enderecos_produto e WHERE e.sku = p.sku AND e.loja_id = $1 AND e.tipo = 'venda') AS gondola,
              (SELECT max(v.dia) FROM vendas_diarias v WHERE v.sku = p.sku AND v.loja_id = $1 AND v.unidades > 0) AS ultima_venda,
              (SELECT json_agg(json_build_object('dia', to_char(v.dia, 'YYYY-MM-DD'), 'unidades', v.unidades)) FROM vendas_diarias v
                WHERE v.sku = p.sku AND v.loja_id = $1 AND v.dia > $2::date - 7 AND v.dia <= $2::date) AS vendas
       FROM produtos p
       WHERE p.ativo
         AND EXISTS (SELECT 1 FROM enderecos_produto e WHERE e.sku = p.sku AND e.loja_id = $1)
         AND ($3::boolean = false OR lower(trim(p.departamento)) = lower(trim($4)))`,
      [sessao.loja, hoje, somenteSetor, sessao.setor ?? ''],
    );

    const PRIORIDADE = { repor_agora: 0, parado: 1, ok: 2, sem_dados: 3 } as const;
    return produtos
      .map((p) => {
        const ind = calcularIndicadores(p.vendas ?? [], p.ultima_venda, p.gondola, hoje);
        return { sku: p.sku, nome: p.nome, departamento: p.departamento, enderecoVenda: p.endereco_venda, diasSemVenda: ind.diasSemVenda, previsao: ind.previsao };
      })
      .filter((p) => p.previsao.alerta === 'parado' || p.previsao.alerta === 'repor_agora')
      .sort((a, b) => PRIORIDADE[a.previsao.alerta] - PRIORIDADE[b.previsao.alerta] || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}
