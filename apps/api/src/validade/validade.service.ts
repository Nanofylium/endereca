import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ErroAcesso } from '../auth/acesso.service';
import { SessaoAtual } from '../auth/tipos';
import { DbService } from '../db/db.service';
import { descreverLocal, NOME_TIPO } from '../etiquetas/codigos';
import { hojeNaLoja } from '../produtos/indicadores';
import { DIAS_PARA_REBAIXAR, JANELA_PADRAO_DIAS, LoteEmEstoque, projetarLotes, Sugestao } from './projecao';
import { RegistrarAcaoDto } from './validade.dto';

export interface AlertaVencimento {
  sku: string;
  nome: string;
  departamento: string;
  lote: string;
  validade: string;
  diasParaVencer: number;
  quantidade: number;
  vendaMediaDia: number;
  vendeAte: number;
  sobra: number;
  valorEmRisco: number | null;
  fornecedor: string | null;
  sugestao: Sugestao;
  caixas: { codigo: string; quantidade: number; local: string }[];
  tratado: { acao: string; observacao: string | null; por: string; em: Date } | null;
}

/** Dias de venda usados para o ritmo médio. */
const DIAS_DE_VENDA = 7;

@Injectable()
export class ValidadeService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lotes que vencem dentro da janela, com quanto deve sobrar pelo ritmo de venda, o valor em risco e o que fazer.
   * O líder vê o departamento do seu setor; gerente e administrador veem a loja toda.
   */
  async alertas(sessao: SessaoAtual, janelaDias = JANELA_PADRAO_DIAS): Promise<{ hoje: string; janelaDias: number; valorEmRisco: number; alertas: AlertaVencimento[] }> {
    const hoje = hojeNaLoja();
    const somenteSetor = sessao.papel === 'lider';
    const caixas = await this.db.query<{
      sku: string;
      nome: string;
      departamento: string;
      lote: string;
      validade: string;
      quantidade: number;
      codigo: string;
      tipo: string | null;
      rua: string | null;
      modulo: string | null;
      nivel: string | null;
      posicao: string | null;
    }>(
      `SELECT v.sku, p.nome, p.departamento, coalesce(v.lote, '') AS lote, v.validade, v.quantidade, v.codigo,
              l.tipo, l.rua, l.modulo, l.nivel, l.posicao
       FROM volumes v
       JOIN produtos p ON p.sku = v.sku
       LEFT JOIN locais l ON l.id = v.local_id
       WHERE v.loja_id = $1 AND v.baixado_em IS NULL AND v.validade IS NOT NULL
         AND v.sku IN (SELECT sku FROM volumes WHERE loja_id = $1 AND baixado_em IS NULL AND validade <= $2::date + $3::int)
         AND ($4::boolean = false OR lower(trim(p.departamento)) = lower(trim($5)))
       ORDER BY v.validade, v.codigo`,
      [sessao.loja, hoje, janelaDias, somenteSetor, sessao.setor ?? ''],
    );
    if (caixas.length === 0) return { hoje, janelaDias, valorEmRisco: 0, alertas: [] };

    const skus = [...new Set(caixas.map((c) => c.sku))];
    const extras = await this.db.query<{
      sku: string;
      media: number;
      gondola: number | null;
      preco: string | null;
      fornecedores: { lote: string; fornecedor: string }[] | null;
    }>(
      `SELECT s.sku,
              coalesce((SELECT sum(unidades) FROM vendas_diarias WHERE sku = s.sku AND loja_id = $1 AND dia > $2::date - $3::int AND dia <= $2::date), 0)::float / $3 AS media,
              (SELECT sum(quantidade)::int FROM enderecos_produto WHERE sku = s.sku AND loja_id = $1 AND tipo = 'venda') AS gondola,
              (SELECT preco_unidade FROM produto_loja WHERE sku = s.sku AND loja_id = $1) AS preco,
              (SELECT json_agg(json_build_object('lote', lote, 'fornecedor', fornecedor)) FROM lotes_produto
                WHERE sku = s.sku AND loja_id = $1 AND fornecedor IS NOT NULL) AS fornecedores
       FROM unnest($4::text[]) AS s(sku)`,
      [sessao.loja, hoje, DIAS_DE_VENDA, skus],
    );
    const porSku = new Map(extras.map((e) => [e.sku, e]));
    const acoes = await this.db.query<{ sku: string; lote: string; validade: string; acao: string; observacao: string | null; decidido_por: string; nome: string; decidido_em: Date }>(
      `SELECT DISTINCT ON (a.sku, a.lote, a.validade) a.sku, a.lote, a.validade, a.acao, a.observacao, a.decidido_por, c.nome, a.decidido_em
       FROM acoes_vencimento a JOIN colaboradores c ON c.matricula = a.decidido_por
       WHERE a.loja_id = $1 AND a.sku = ANY($2::text[])
       ORDER BY a.sku, a.lote, a.validade, a.decidido_em DESC`,
      [sessao.loja, skus],
    );
    const chave = (sku: string, lote: string, validade: string) => `${sku}|${lote}|${validade}`;
    const tratados = new Map(acoes.map((a) => [chave(a.sku, a.lote, a.validade), a]));

    const alertas: AlertaVencimento[] = [];
    for (const sku of skus) {
      const doSku = caixas.filter((c) => c.sku === sku);
      const extra = porSku.get(sku)!;
      const lotes = new Map<string, LoteEmEstoque & { caixas: typeof doSku }>();
      for (const c of doSku) {
        const k = `${c.lote}|${c.validade}`;
        const l = lotes.get(k) ?? { lote: c.lote, validade: c.validade, quantidade: 0, caixas: [] };
        l.quantidade += c.quantidade;
        l.caixas.push(c);
        lotes.set(k, l);
      }
      const fornecedores = extra.fornecedores ?? [];
      const preco = extra.preco === null ? null : Number(extra.preco);
      const projetados = projetarLotes([...lotes.values()], {
        hoje,
        mediaDiaria: extra.media,
        naGondola: extra.gondola ?? 0,
        temFornecedor: fornecedores.length > 0,
      });
      for (const p of projetados) {
        if (p.diasParaVencer > janelaDias) continue;
        const l = lotes.get(`${p.lote}|${p.validade}`)!;
        const tratado = tratados.get(chave(sku, p.lote, p.validade));
        alertas.push({
          sku,
          nome: doSku[0].nome,
          departamento: doSku[0].departamento,
          lote: p.lote,
          validade: p.validade,
          diasParaVencer: p.diasParaVencer,
          quantidade: p.quantidade,
          vendaMediaDia: Math.round(extra.media * 10) / 10,
          vendeAte: p.vendeAte,
          sobra: p.sobra,
          valorEmRisco: preco === null ? null : Math.round(p.sobra * preco * 100) / 100,
          fornecedor: (fornecedores.find((f) => f.lote === p.lote) ?? fornecedores[0])?.fornecedor ?? null,
          sugestao: p.sugestao,
          caixas: l.caixas.map((c) => ({
            codigo: c.codigo,
            quantidade: c.quantidade,
            local: c.rua === null ? 'Aguardando guardar' : `${NOME_TIPO[c.tipo!] ?? c.tipo} · ${descreverLocal({ rua: c.rua, modulo: c.modulo, nivel: c.nivel, posicao: c.posicao })}`,
          })),
          tratado: tratado
            ? { acao: tratado.acao, observacao: tratado.observacao, por: tratado.nome, em: tratado.decidido_em }
            : null,
        });
      }
    }

    // Primeiro o que ainda não foi tratado e tem sobra; dentro disso, o vencido, o que vence na semana e o que vale mais.
    const urgencia = (dias: number) => (dias <= 0 ? 0 : dias <= DIAS_PARA_REBAIXAR ? 1 : 2);
    const ordem = (a: AlertaVencimento) => (a.tratado ? 2 : a.sobra > 0 ? 0 : 1);
    alertas.sort(
      (a, b) =>
        ordem(a) - ordem(b) ||
        urgencia(a.diasParaVencer) - urgencia(b.diasParaVencer) ||
        (b.valorEmRisco ?? 0) - (a.valorEmRisco ?? 0) ||
        a.diasParaVencer - b.diasParaVencer,
    );
    const valorEmRisco = Math.round(alertas.filter((a) => !a.tratado).reduce((s, a) => s + (a.valorEmRisco ?? 0), 0) * 100) / 100;
    return { hoje, janelaDias, valorEmRisco, alertas };
  }

  /** Guarda a decisão do líder sobre um lote e deixa registrado na auditoria. */
  async registrarAcao(sessao: SessaoAtual, dados: RegistrarAcaoDto) {
    const [existe] = await this.db.query<{ departamento: string }>(
      `SELECT p.departamento FROM volumes v JOIN produtos p ON p.sku = v.sku
       WHERE v.loja_id = $1 AND v.sku = $2 AND coalesce(v.lote, '') = $3 AND v.validade = $4 LIMIT 1`,
      [sessao.loja, dados.sku, dados.lote, dados.validade],
    );
    if (!existe) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'lote_nao_encontrado', 'Não há caixas desse lote nesta loja.');
    if (sessao.papel === 'lider' && existe.departamento.trim().toLowerCase() !== (sessao.setor ?? '').trim().toLowerCase()) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'outro_setor', 'Esse produto é de outro setor.');
    }
    const observacao = dados.observacao?.trim() || null;
    const [acao] = await this.db.transacao(async (tx) => {
      const linhas = await this.db.query<{ id: string; decidido_em: Date }>(
        `INSERT INTO acoes_vencimento (loja_id, sku, lote, validade, acao, observacao, decidido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, decidido_em`,
        [sessao.loja, dados.sku, dados.lote, dados.validade, dados.acao, observacao, sessao.sub],
        tx,
      );
      await this.auditoria.registrar(
        { autor: sessao.sub, acao: 'vencimento.acao', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { ...dados, observacao } },
        tx,
      );
      return linhas;
    });
    return { id: acao.id, acao: dados.acao, em: acao.decidido_em };
  }
}
