import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ErroAcesso } from '../auth/acesso.service';
import { mesmoSetor } from '../auth/escopo';
import { Papel, SessaoAtual } from '../auth/tipos';
import { DbService, Executor } from '../db/db.service';
import { descreverLocal, NOME_TIPO } from '../etiquetas/codigos';
import { hojeNaLoja, interpretarCodigoLido } from '../produtos/indicadores';
import { BoaDoDiaDto } from './tarefas.dto';

export type SituacaoTarefa = 'aguardando_lider' | 'atribuida' | 'concluida' | 'sem_produto';

interface LinhaTarefa {
  id: string;
  sku: string;
  nome: string;
  setor: string;
  dia: string;
  instrucoes: string | null;
  criada_por: string;
  criada_em: Date;
  responsavel: string | null;
  responsavel_nome: string | null;
  atribuida_em: Date | null;
  situacao: SituacaoTarefa;
  concluida_em: Date | null;
  observacao: string | null;
}

export interface LocalComQuantidade {
  nomeTipo: string;
  descricao: string;
  quantidade: number | null;
}

export interface Tarefa {
  id: string;
  tipo: 'boa_do_dia';
  sku: string;
  produto: string;
  setor: string;
  dia: string;
  instrucoes: string | null;
  criadaPor: string;
  criadaEm: Date;
  responsavel: { matricula: string; nome: string } | null;
  atribuidaEm: Date | null;
  situacao: SituacaoTarefa;
  concluidaEm: Date | null;
  observacao: string | null;
  enderecoVenda: LocalComQuantidade | null;
  estoque: LocalComQuantidade[];
}

export interface Falta {
  id: string;
  sku: string;
  produto: string;
  departamento: string;
  reportadoPor: string;
  reportadoPorNome: string | null;
  reportadoEm: Date;
  estoque: number;
  observacao: string | null;
}

const SELECT_TAREFA = `SELECT t.id, t.sku, p.nome, t.setor, t.dia, t.instrucoes, t.criada_por, t.criada_em, t.responsavel,
    c.nome AS responsavel_nome, t.atribuida_em, t.situacao, t.concluida_em, t.observacao
  FROM tarefas t JOIN produtos p ON p.sku = t.sku LEFT JOIN colaboradores c ON c.matricula = t.responsavel`;

const PAPEIS_EXECUTAM: Papel[] = ['repositor', 'lider'];

@Injectable()
export class TarefasService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Gerente operacional escolhe a Boa do Dia e manda para o setor; o líder do setor decide quem faz. */
  async enviarBoaDoDia(sessao: SessaoAtual, dados: BoaDoDiaDto): Promise<Tarefa> {
    const produto = await this.produto(dados.produto);
    const setor = dados.setor?.trim() || produto.departamento;
    const dia = dados.dia ?? hojeNaLoja();
    const [criada] = await this.db.query<{ id: string }>(
      `INSERT INTO tarefas (loja_id, tipo, sku, setor, dia, instrucoes, criada_por) VALUES ($1, 'boa_do_dia', $2, $3, $4, $5, $6)
       ON CONFLICT (loja_id, dia, sku) WHERE tipo = 'boa_do_dia' DO NOTHING RETURNING id`,
      [sessao.loja, produto.sku, setor, dia, dados.instrucoes?.trim() || null, sessao.sub],
    );
    if (!criada) throw new ErroAcesso(HttpStatus.CONFLICT, 'boa_do_dia_repetida', 'Este produto já é Boa do Dia nesta data.');
    await this.db.query("INSERT INTO avisos_lider (loja_id, tipo, texto) VALUES ($1, 'boa_do_dia', $2)", [
      sessao.loja,
      `Boa do Dia para ${setor}: ${produto.nome}. Escolha quem vai preparar.`,
    ]);
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'boa_do_dia.enviada', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { sku: produto.sku, setor, dia } });
    return this.uma(sessao.loja, criada.id);
  }

  /** O líder vê as tarefas do próprio setor; gerente e administrador, as da loja toda. */
  async listar(sessao: SessaoAtual, dia?: string): Promise<Tarefa[]> {
    const params: unknown[] = [sessao.loja, dia ?? hojeNaLoja()];
    let filtro = '';
    if (sessao.papel === 'lider') {
      params.push(sessao.setor ?? '');
      filtro = 'AND lower(trim(t.setor)) = lower(trim($3))';
    }
    const linhas = await this.db.query<LinhaTarefa>(`${SELECT_TAREFA} WHERE t.loja_id = $1 AND t.dia = $2 ${filtro} ORDER BY t.setor, t.criada_em`, params);
    return Promise.all(linhas.map((l) => this.completar(sessao.loja, l)));
  }

  async atribuir(sessao: SessaoAtual, id: string, matricula: string): Promise<Tarefa> {
    const tarefa = await this.linha(sessao.loja, id);
    this.conferirSetor(sessao, tarefa.setor);
    if (tarefa.situacao === 'concluida') throw new ErroAcesso(HttpStatus.CONFLICT, 'tarefa_concluida', 'Esta tarefa já foi concluída.');

    const [alvo] = await this.db.query<{ matricula: string; nome: string; papel: Papel; setor: string | null }>(
      'SELECT matricula, nome, papel, setor FROM colaboradores WHERE matricula = $1 AND loja_id = $2 AND ativo_no_rh',
      [matricula, sessao.loja],
    );
    if (!alvo || !PAPEIS_EXECUTAM.includes(alvo.papel)) {
      throw new ErroAcesso(HttpStatus.NOT_FOUND, 'colaborador_inexistente', 'Escolha um repositor ou líder ativo desta loja.');
    }
    if (sessao.papel === 'lider' && !(alvo.matricula === sessao.sub || (alvo.papel === 'repositor' && mesmoSetor(alvo.setor, sessao.setor)))) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'fora_do_setor', 'Escolha alguém da sua equipe. Para outro setor, fale com o gerente operacional.');
    }

    await this.db.query(
      "UPDATE tarefas SET responsavel = $1, atribuida_por = $2, atribuida_em = now(), situacao = 'atribuida', concluida_em = NULL, observacao = NULL WHERE id = $3",
      [alvo.matricula, sessao.sub, id],
    );
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'tarefa.atribuida', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { tarefa: id, responsavel: alvo.matricula } });
    return this.uma(sessao.loja, id);
  }

  /** Tarefas do próprio colaborador: as pendentes e as que ele fechou hoje. */
  async minhas(sessao: SessaoAtual): Promise<Tarefa[]> {
    const linhas = await this.db.query<LinhaTarefa>(
      `${SELECT_TAREFA} WHERE t.loja_id = $1 AND t.responsavel = $2 AND (t.situacao = 'atribuida' OR t.dia = $3)
       ORDER BY (t.situacao = 'atribuida') DESC, t.dia, t.criada_em`,
      [sessao.loja, sessao.sub, hojeNaLoja()],
    );
    return Promise.all(linhas.map((l) => this.completar(sessao.loja, l)));
  }

  async concluir(sessao: SessaoAtual, id: string, resultado: 'feito' | 'sem_produto', observacao?: string) {
    const tarefa = await this.linha(sessao.loja, id);
    if (tarefa.responsavel !== sessao.sub) throw new ErroAcesso(HttpStatus.FORBIDDEN, 'nao_e_responsavel', 'Esta tarefa está com outra pessoa.');
    if (tarefa.situacao !== 'atribuida') throw new ErroAcesso(HttpStatus.CONFLICT, 'tarefa_fechada', 'Esta tarefa já foi encerrada.');

    const texto = observacao?.trim() || null;
    let falta: Awaited<ReturnType<TarefasService['registrarFalta']>> | null = null;
    await this.db.transacao(async (cliente) => {
      await this.db.query('UPDATE tarefas SET situacao = $1, concluida_em = now(), observacao = $2 WHERE id = $3', [
        resultado === 'feito' ? 'concluida' : 'sem_produto',
        texto,
        id,
      ], cliente);
      if (resultado === 'sem_produto') falta = await this.registrarFalta(sessao, tarefa.sku, texto ?? 'Boa do Dia sem produto', id, cliente);
    });
    await this.auditoria.registrar({ autor: sessao.sub, acao: `tarefa.${resultado}`, lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { tarefa: id } });
    return { tarefa: await this.uma(sessao.loja, id), falta };
  }

  /**
   * Não tem o produto na gôndola para escanear. Mostra onde ainda há estoque para buscar;
   * sem estoque registrado em lugar nenhum, avisa o líder.
   */
  async registrarFalta(sessao: SessaoAtual, codigo: string, observacao: string | null, tarefaId: string | null = null, executor?: Executor) {
    const produto = await this.produto(codigo, executor);
    const estoque = await this.estoque(sessao.loja, produto.sku, executor);
    const total = estoque.reduce((s, e) => s + (e.quantidade ?? 0), 0);
    const [falta] = await this.db.query<{ id: string }>(
      'INSERT INTO faltas (loja_id, sku, reportado_por, estoque, observacao, tarefa_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [sessao.loja, produto.sku, sessao.sub, total, observacao, tarefaId],
      executor,
    );
    if (total === 0) {
      await this.db.query("INSERT INTO avisos_lider (loja_id, tipo, texto) VALUES ($1, 'falta', $2)", [
        sessao.loja,
        `Sem ${produto.nome} na gôndola e sem estoque registrado na loja (${produto.departamento}). Avisado por ${sessao.sub}.`,
      ], executor);
    }
    return {
      id: falta.id,
      sku: produto.sku,
      produto: produto.nome,
      estoque,
      mensagem:
        total > 0
          ? `Há ${total} un. no estoque. Busque no endereço indicado e reponha a gôndola.`
          : 'Não há estoque registrado na loja. O líder foi avisado para pedir reposição.',
    };
  }

  async faltas(sessao: SessaoAtual): Promise<Falta[]> {
    const params: unknown[] = [sessao.loja];
    let filtro = '';
    if (sessao.papel === 'lider') {
      params.push(sessao.setor ?? '');
      filtro = 'AND lower(trim(p.departamento)) = lower(trim($2))';
    }
    const linhas = await this.db.query<{
      id: string;
      sku: string;
      nome: string;
      departamento: string;
      reportado_por: string;
      reportado_nome: string | null;
      reportado_em: Date;
      estoque: number;
      observacao: string | null;
    }>(
      `SELECT f.id, f.sku, p.nome, p.departamento, f.reportado_por, c.nome AS reportado_nome, f.reportado_em, f.estoque, f.observacao
       FROM faltas f JOIN produtos p ON p.sku = f.sku LEFT JOIN colaboradores c ON c.matricula = f.reportado_por
       WHERE f.loja_id = $1 AND f.resolvida_em IS NULL ${filtro}
       ORDER BY f.estoque, f.reportado_em DESC LIMIT 100`,
      params,
    );
    return linhas.map((f) => ({
      id: f.id,
      sku: f.sku,
      produto: f.nome,
      departamento: f.departamento,
      reportadoPor: f.reportado_por,
      reportadoPorNome: f.reportado_nome,
      reportadoEm: f.reportado_em,
      estoque: f.estoque,
      observacao: f.observacao,
    }));
  }

  async resolverFalta(sessao: SessaoAtual, id: string) {
    const [falta] = await this.db.query<{ departamento: string }>(
      'SELECT p.departamento FROM faltas f JOIN produtos p ON p.sku = f.sku WHERE f.id = $1 AND f.loja_id = $2 AND f.resolvida_em IS NULL',
      [id, sessao.loja],
    );
    if (!falta) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'falta_inexistente', 'Aviso de falta não encontrado ou já resolvido.');
    this.conferirSetor(sessao, falta.departamento);
    await this.db.query('UPDATE faltas SET resolvida_em = now(), resolvida_por = $1 WHERE id = $2', [sessao.sub, id]);
    return { id, resolvida: true };
  }

  private conferirSetor(sessao: SessaoAtual, setor: string) {
    if (sessao.papel === 'lider' && !mesmoSetor(setor, sessao.setor)) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'fora_do_setor', 'Isto é de outro setor. Fale com o gerente operacional.');
    }
  }

  private async produto(codigo: string, executor?: Executor) {
    const { sku, eanOuSku } = interpretarCodigoLido(codigo);
    const [p] = await this.db.query<{ sku: string; nome: string; departamento: string }>(
      sku
        ? 'SELECT sku, nome, departamento FROM produtos WHERE ativo AND sku = $1'
        : 'SELECT sku, nome, departamento FROM produtos WHERE ativo AND (ean = $1 OR sku = $1)',
      [sku ?? eanOuSku],
      executor,
    );
    if (!p) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Produto não encontrado no catálogo.');
    return p;
  }

  private async enderecos(lojaId: string, sku: string, executor?: Executor) {
    const linhas = await this.db.query<{ tipo: string; rua: string; modulo: string | null; nivel: string | null; posicao: string | null; quantidade: number | null }>(
      `SELECT tipo, rua, modulo, nivel, posicao, quantidade FROM enderecos_produto WHERE sku = $1 AND loja_id = $2
       ORDER BY principal DESC, quantidade DESC NULLS LAST`,
      [sku, lojaId],
      executor,
    );
    return linhas.map((e) => ({ tipo: e.tipo, nomeTipo: NOME_TIPO[e.tipo] ?? e.tipo, descricao: descreverLocal(e), quantidade: e.quantidade }));
  }

  private async estoque(lojaId: string, sku: string, executor?: Executor): Promise<LocalComQuantidade[]> {
    return (await this.enderecos(lojaId, sku, executor))
      .filter((e) => e.tipo !== 'venda' && (e.quantidade ?? 0) > 0)
      .map(({ nomeTipo, descricao, quantidade }) => ({ nomeTipo, descricao, quantidade }));
  }

  private async linha(lojaId: string, id: string): Promise<LinhaTarefa> {
    if (!/^\d{1,18}$/.test(id)) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'tarefa_inexistente', 'Tarefa não encontrada.');
    const [linha] = await this.db.query<LinhaTarefa>(`${SELECT_TAREFA} WHERE t.id = $1 AND t.loja_id = $2`, [id, lojaId]);
    if (!linha) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'tarefa_inexistente', 'Tarefa não encontrada.');
    return linha;
  }

  private async uma(lojaId: string, id: string): Promise<Tarefa> {
    return this.completar(lojaId, await this.linha(lojaId, id));
  }

  private async completar(lojaId: string, l: LinhaTarefa): Promise<Tarefa> {
    const enderecos = await this.enderecos(lojaId, l.sku);
    const venda = enderecos.find((e) => e.tipo === 'venda');
    return {
      id: l.id,
      tipo: 'boa_do_dia',
      sku: l.sku,
      produto: l.nome,
      setor: l.setor,
      dia: l.dia,
      instrucoes: l.instrucoes,
      criadaPor: l.criada_por,
      criadaEm: l.criada_em,
      responsavel: l.responsavel ? { matricula: l.responsavel, nome: l.responsavel_nome ?? l.responsavel } : null,
      atribuidaEm: l.atribuida_em,
      situacao: l.situacao,
      concluidaEm: l.concluida_em,
      observacao: l.observacao,
      enderecoVenda: venda ? { nomeTipo: venda.nomeTipo, descricao: venda.descricao, quantidade: venda.quantidade } : null,
      estoque: enderecos.filter((e) => e.tipo !== 'venda' && (e.quantidade ?? 0) > 0).map(({ nomeTipo, descricao, quantidade }) => ({ nomeTipo, descricao, quantidade })),
    };
  }
}
