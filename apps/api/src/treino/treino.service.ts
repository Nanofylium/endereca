import { HttpStatus, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ErroAcesso } from '../auth/acesso.service';
import { SessaoAtual } from '../auth/tipos';
import { DbService } from '../db/db.service';
import { descreverLocal } from '../etiquetas/codigos';
import { hojeNaLoja } from '../produtos/indicadores';
import { APROVACAO, CARREIRA, Licao, nivelPorPontos, PONTOS_POR_ACERTO, PONTOS_POR_DESAFIO, TRILHA } from './conteudo';

/** Desafios que contam pontos por dia, para o placar medir conhecimento e não insistência. */
export const DESAFIOS_COM_PONTOS_POR_DIA = 10;

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

@Injectable()
export class TreinoService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Painel do treino: pontos, nível, lições com o progresso e o caminho de carreira. */
  async resumo(sessao: SessaoAtual) {
    const licoes = await this.db.query<{ licao: string; acertos: number; total: number; concluida_em: Date | null }>(
      'SELECT licao, acertos, total, concluida_em FROM treino_licoes WHERE matricula = $1',
      [sessao.sub],
    );
    const porLicao = new Map(licoes.map((l) => [l.licao, l]));
    const pontos = await this.pontos(sessao.sub);
    const [hoje] = await this.db.query<{ feitos: number; acertos: number }>(
      'SELECT count(*)::int AS feitos, count(*) FILTER (WHERE acertou)::int AS acertos FROM treino_desafios WHERE matricula = $1 AND dia = $2',
      [sessao.sub, hojeNaLoja()],
    );
    return {
      pontos,
      nivel: nivelPorPontos(pontos),
      licoes: TRILHA.map((l) => {
        const p = porLicao.get(l.id);
        return {
          id: l.id,
          titulo: l.titulo,
          resumo: l.resumo,
          minutos: l.minutos,
          perguntas: l.perguntas.length,
          acertos: p?.acertos ?? null,
          concluida: !!p?.concluida_em,
        };
      }),
      desafiosHoje: hoje,
      carreira: CARREIRA,
    };
  }

  /** A lição para estudar, com as perguntas sem a resposta certa. */
  licao(id: string) {
    const l = this.buscar(id);
    return { id: l.id, titulo: l.titulo, resumo: l.resumo, minutos: l.minutos, topicos: l.topicos, perguntas: l.perguntas.map((p) => ({ pergunta: p.pergunta, opcoes: p.opcoes })) };
  }

  /** Corrige as respostas. Vale a melhor tentativa; com 70% de acerto a lição conta como concluída. */
  async responder(sessao: SessaoAtual, id: string, respostas: number[]) {
    const l = this.buscar(id);
    if (respostas.length !== l.perguntas.length) {
      throw new ErroAcesso(HttpStatus.BAD_REQUEST, 'respostas_incompletas', 'Responda todas as perguntas da lição.');
    }
    const correcoes = l.perguntas.map((p, i) => ({ acertou: respostas[i] === p.correta, correta: p.correta, explicacao: p.explicacao }));
    const acertos = correcoes.filter((c) => c.acertou).length;
    const aprovado = acertos / l.perguntas.length >= APROVACAO;
    const antes = await this.pontos(sessao.sub);
    await this.db.query(
      `INSERT INTO treino_licoes (matricula, licao, acertos, total, concluida_em) VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END)
       ON CONFLICT (matricula, licao) DO UPDATE SET
         acertos = GREATEST(treino_licoes.acertos, EXCLUDED.acertos), total = EXCLUDED.total, tentativas = treino_licoes.tentativas + 1,
         concluida_em = COALESCE(treino_licoes.concluida_em, EXCLUDED.concluida_em), atualizado_em = now()`,
      [sessao.sub, l.id, acertos, l.perguntas.length, aprovado],
    );
    const pontos = await this.pontos(sessao.sub);
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'treino.licao', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { licao: l.id, acertos, total: l.perguntas.length } });
    return { acertos, total: l.perguntas.length, aprovado, correcoes, pontos, ganhou: pontos - antes, ...this.subiu(antes, pontos) };
  }

  /** Desafio "ache o produto" com um produto de verdade da loja e quatro endereços para escolher. */
  async desafio(sessao: SessaoAtual) {
    const candidatos = await this.db.query<{ sku: string; nome: string; ean: string | null; rua: string; modulo: string | null; nivel: string | null; posicao: string | null }>(
      `SELECT DISTINCT ON (e.sku) e.sku, p.nome, p.ean, e.rua, e.modulo, e.nivel, e.posicao
       FROM enderecos_produto e JOIN produtos p ON p.sku = e.sku AND p.ativo
       WHERE e.loja_id = $1 AND e.tipo = 'venda'
       ORDER BY e.sku, e.principal DESC, e.id`,
      [sessao.loja],
    );
    const enderecos = [...new Set(candidatos.map((c) => descreverLocal(c)))];
    if (candidatos.length === 0 || enderecos.length < 2) {
      throw new ErroAcesso(HttpStatus.NOT_FOUND, 'sem_desafio', 'A loja ainda não tem produtos suficientes com endereço para o desafio.');
    }
    const alvo = candidatos[randomInt(candidatos.length)];
    const certo = descreverLocal(alvo);
    const outros = embaralhar(enderecos.filter((e) => e !== certo)).slice(0, 3);
    return { sku: alvo.sku, nome: alvo.nome, ean: alvo.ean, opcoes: embaralhar([certo, ...outros]) };
  }

  async responderDesafio(sessao: SessaoAtual, sku: string, resposta: string) {
    const [venda] = await this.db.query<{ rua: string; modulo: string | null; nivel: string | null; posicao: string | null }>(
      `SELECT rua, modulo, nivel, posicao FROM enderecos_produto WHERE sku = $1 AND loja_id = $2 AND tipo = 'venda'
       ORDER BY principal DESC, id LIMIT 1`,
      [sku, sessao.loja],
    );
    if (!venda) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Este produto não tem lugar na área de venda.');
    const correta = descreverLocal(venda);
    const acertou = resposta.trim() === correta;
    const hoje = hojeNaLoja();
    const antes = await this.pontos(sessao.sub);
    await this.db.query('INSERT INTO treino_desafios (matricula, loja_id, sku, acertou, dia) VALUES ($1, $2, $3, $4, $5)', [sessao.sub, sessao.loja, sku, acertou, hoje]);
    const pontos = await this.pontos(sessao.sub);
    return { acertou, correta, pontos, ganhou: pontos - antes, ...this.subiu(antes, pontos) };
  }

  /** Progresso de quem está treinando. O líder vê o próprio setor; gerente e administrador, a loja toda. */
  async equipe(sessao: SessaoAtual) {
    const params: unknown[] = [sessao.loja];
    let filtro = '';
    if (sessao.papel === 'lider') {
      params.push(sessao.setor ?? '');
      filtro = 'AND lower(trim(c.setor)) = lower(trim($2))';
    }
    const pessoas = await this.db.query<{ matricula: string; nome: string; setor: string | null; concluidas: number; ultima: Date | null }>(
      `SELECT c.matricula, c.nome, c.setor,
         (SELECT count(*)::int FROM treino_licoes t WHERE t.matricula = c.matricula AND t.concluida_em IS NOT NULL) AS concluidas,
         (SELECT max(t.atualizado_em) FROM treino_licoes t WHERE t.matricula = c.matricula) AS ultima
       FROM colaboradores c
       WHERE c.loja_id = $1 AND c.papel = 'repositor' AND c.ativo_no_rh ${filtro}
       ORDER BY c.nome`,
      params,
    );
    return Promise.all(
      pessoas.map(async (p) => {
        const pontos = await this.pontos(p.matricula);
        return {
          matricula: p.matricula,
          nome: p.nome,
          setor: p.setor,
          pontos,
          nivel: nivelPorPontos(pontos).atual.nome,
          licoesConcluidas: p.concluidas,
          licoesTotal: TRILHA.length,
          ultimaAtividade: p.ultima,
        };
      }),
    );
  }

  private async pontos(matricula: string): Promise<number> {
    const [r] = await this.db.query<{ licoes: number; desafios: number }>(
      `SELECT
         (SELECT COALESCE(sum(acertos), 0)::int FROM treino_licoes WHERE matricula = $1) AS licoes,
         (SELECT COALESCE(sum(LEAST(n, $2)), 0)::int FROM (
            SELECT count(*) AS n FROM treino_desafios WHERE matricula = $1 AND acertou GROUP BY dia) d) AS desafios`,
      [matricula, DESAFIOS_COM_PONTOS_POR_DIA],
    );
    return r.licoes * PONTOS_POR_ACERTO + r.desafios * PONTOS_POR_DESAFIO;
  }

  private subiu(antes: number, depois: number) {
    const a = nivelPorPontos(antes).atual;
    const d = nivelPorPontos(depois).atual;
    return { nivel: nivelPorPontos(depois), subiuDeNivel: a.nome !== d.nome ? d.nome : null };
  }

  private buscar(id: string): Licao {
    const l = TRILHA.find((x) => x.id === id);
    if (!l) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'licao_inexistente', 'Lição não encontrada.');
    return l;
  }
}
