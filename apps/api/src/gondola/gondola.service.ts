import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ErroAcesso } from '../auth/acesso.service';
import { SessaoAtual } from '../auth/tipos';
import { DbService } from '../db/db.service';
import { descreverLocal } from '../etiquetas/codigos';
import { interpretarCodigoLido } from '../produtos/indicadores';
import { TarefasService } from '../tarefas/tarefas.service';
import { ConferirDto, CriarTerminalDto } from './gondola.dto';
import { hashChaveTerminal } from './terminal.guard';

/** Depois de tantos dias sem ninguém conferir, o produto aparece para conferir de novo na gôndola. */
export const DIAS_PARA_RECONFERIR = 30;

interface LinhaGondola {
  sku: string;
  ean: string | null;
  nome: string;
  nivel: string | null;
  posicao: string | null;
  quantidade: number | null;
  confirmado_em: Date | null;
  confirmado_por: string | null;
  unidades_embalagem: number | null;
  preco_unidade: string | null;
  preco_atacado: string | null;
  quantidade_atacado: number | null;
  preco_embalagem: string | null;
}

const vazioParaNulo = (v?: string) => (v?.trim() ? v.trim() : null);
const numero = (v: string | null) => (v === null ? null : Number(v));

@Injectable()
export class GondolaService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
    private readonly tarefas: TarefasService,
  ) {}

  /** Ruas e módulos da área de venda que têm produto, para escolher a gôndola. */
  async ruas(sessao: SessaoAtual) {
    return this.db.query<{ rua: string; modulo: string | null; produtos: number }>(
      `SELECT rua, modulo, count(*)::int AS produtos FROM enderecos_produto
       WHERE loja_id = $1 AND tipo = 'venda' GROUP BY rua, modulo ORDER BY rua, modulo NULLS FIRST`,
      [sessao.loja],
    );
  }

  /**
   * Planograma digital de um módulo: o que vai em cada nível, com preço de varejo e de atacado.
   * É o que antes ficava impresso nas etiquetas da prateleira.
   */
  async modulo(sessao: SessaoAtual, rua: string, modulo: string | null) {
    const linhas = await this.db.query<LinhaGondola>(
      `SELECT p.sku, p.ean, p.nome, e.nivel, e.posicao, e.quantidade, e.confirmado_em, c.nome AS confirmado_por,
         p.unidades_embalagem, pl.preco_unidade, pl.preco_atacado, pl.quantidade_atacado, pl.preco_embalagem
       FROM enderecos_produto e
       JOIN produtos p ON p.sku = e.sku AND p.ativo
       LEFT JOIN produto_loja pl ON pl.sku = e.sku AND pl.loja_id = e.loja_id
       LEFT JOIN colaboradores c ON c.matricula = e.confirmado_por
       WHERE e.loja_id = $1 AND e.tipo = 'venda' AND e.rua = $2 AND e.modulo IS NOT DISTINCT FROM $3
       ORDER BY NULLIF(regexp_replace(e.nivel, '\\D', '', 'g'), '')::int DESC NULLS LAST, e.nivel DESC NULLS LAST,
         e.posicao NULLS FIRST, p.nome`,
      [sessao.loja, rua.trim(), vazioParaNulo(modulo ?? undefined)],
    );
    const limite = Date.now() - DIAS_PARA_RECONFERIR * 86_400_000;
    const niveis = new Map<string, { nivel: string | null; produtos: unknown[] }>();
    for (const l of linhas) {
      const chave = l.nivel ?? '';
      if (!niveis.has(chave)) niveis.set(chave, { nivel: l.nivel, produtos: [] });
      niveis.get(chave)!.produtos.push({
        sku: l.sku,
        ean: l.ean,
        nome: l.nome,
        posicao: l.posicao,
        quantidade: l.quantidade,
        unidadesEmbalagem: l.unidades_embalagem,
        precoUnidade: numero(l.preco_unidade),
        precoAtacado: numero(l.preco_atacado),
        quantidadeAtacado: l.quantidade_atacado,
        precoEmbalagem: numero(l.preco_embalagem),
        confirmadoEm: l.confirmado_em,
        confirmadoPor: l.confirmado_por,
        conferirDeNovo: !l.confirmado_em || l.confirmado_em.getTime() < limite,
      });
    }
    return { rua: rua.trim(), modulo: vazioParaNulo(modulo ?? undefined), niveis: [...niveis.values()] };
  }

  /**
   * O repositor bipa o EAN da embalagem na frente da prateleira e diz o nível: o Endereça confirma,
   * muda o produto de lugar ou cadastra o lugar novo. Nenhuma etiqueta é impressa.
   */
  async conferir(sessao: SessaoAtual, dados: ConferirDto) {
    const produto = await this.produto(dados.produto);
    const lugar = {
      rua: dados.rua.trim(),
      modulo: vazioParaNulo(dados.modulo),
      nivel: vazioParaNulo(dados.nivel),
      posicao: vazioParaNulo(dados.posicao),
    };
    const chave = [sessao.loja, lugar.rua, lugar.modulo, lugar.nivel, lugar.posicao];
    const mesmoLugar = `loja_id = $1 AND tipo = 'venda' AND rua = $2 AND modulo IS NOT DISTINCT FROM $3
      AND nivel IS NOT DISTINCT FROM $4 AND posicao IS NOT DISTINCT FROM $5`;
    const quantidade = dados.quantidade ?? null;

    const r = await this.db.transacao(async (cliente) => {
      let substituido: { sku: string; nome: string } | null = null;
      if (lugar.posicao) {
        const ocupantes = await this.db.query<{ id: string; sku: string; nome: string }>(
          `SELECT e.id, e.sku, p.nome FROM enderecos_produto e JOIN produtos p ON p.sku = e.sku
           WHERE e.loja_id = $1 AND e.tipo = 'venda' AND e.rua = $2 AND e.modulo IS NOT DISTINCT FROM $3
             AND e.nivel IS NOT DISTINCT FROM $4 AND e.posicao = $5 AND e.sku <> $6
           FOR UPDATE OF e`,
          [...chave, produto.sku],
          cliente,
        );
        if (ocupantes.length && !dados.substituir) {
          throw new ErroAcesso(HttpStatus.CONFLICT, 'posicao_ocupada', `Nesta posição está ${ocupantes[0].nome}. Se ele saiu daqui, confirme a troca.`);
        }
        if (ocupantes.length) {
          await this.db.query('DELETE FROM enderecos_produto WHERE id = ANY($1::bigint[])', [ocupantes.map((o) => o.id)], cliente);
          substituido = { sku: ocupantes[0].sku, nome: ocupantes[0].nome };
        }
      }

      const [aqui] = await this.db.query<{ id: string }>(
        `SELECT id FROM enderecos_produto WHERE ${mesmoLugar} AND sku = $6 FOR UPDATE`,
        [...chave, produto.sku],
        cliente,
      );
      if (aqui) {
        await this.db.query(
          'UPDATE enderecos_produto SET confirmado_em = now(), confirmado_por = $2, quantidade = COALESCE($3, quantidade) WHERE id = $1',
          [aqui.id, sessao.sub, quantidade],
          cliente,
        );
        return { resultado: 'confirmado' as const, antes: null, substituido };
      }

      const [principal] = await this.db.query<{ id: string; rua: string; modulo: string | null; nivel: string | null; posicao: string | null }>(
        `SELECT id, rua, modulo, nivel, posicao FROM enderecos_produto WHERE loja_id = $1 AND tipo = 'venda' AND sku = $2
         ORDER BY principal DESC, confirmado_em DESC NULLS LAST, id LIMIT 1 FOR UPDATE`,
        [sessao.loja, produto.sku],
        cliente,
      );
      if (principal) {
        await this.db.query(
          `UPDATE enderecos_produto SET rua = $2, modulo = $3, nivel = $4, posicao = $5, principal = true,
             confirmado_em = now(), confirmado_por = $6, quantidade = COALESCE($7, quantidade) WHERE id = $1`,
          [principal.id, lugar.rua, lugar.modulo, lugar.nivel, lugar.posicao, sessao.sub, quantidade],
          cliente,
        );
        return { resultado: 'movido' as const, antes: descreverLocal(principal), substituido };
      }

      await this.db.query(
        `INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, posicao, quantidade, principal, confirmado_em, confirmado_por)
         VALUES ($1, $2, 'venda', $3, $4, $5, $6, $7, true, now(), $8)`,
        [produto.sku, sessao.loja, lugar.rua, lugar.modulo, lugar.nivel, lugar.posicao, quantidade, sessao.sub],
        cliente,
      );
      return { resultado: 'novo' as const, antes: null, substituido };
    });

    const endereco = descreverLocal(lugar);
    await this.auditoria.registrar({
      autor: sessao.sub,
      acao: 'gondola.conferida',
      lojaId: sessao.loja,
      aparelhoId: sessao.ap,
      detalhes: { sku: produto.sku, endereco, resultado: r.resultado, antes: r.antes, substituido: r.substituido?.sku ?? null },
    });
    // Contou a frente: abaixo do mínimo o Meeseeks nasce, de volta ao mínimo ele some.
    const meeseeks = quantidade === null ? null : await this.tarefas.invocarMeeseeks(sessao.loja, produto.sku);
    return { ...r, produto: { sku: produto.sku, nome: produto.nome }, endereco, meeseeks };
  }

  /** O que o cliente vê ao passar o produto no leitor da gôndola: preço de varejo, de atacado e onde fica. */
  async consultar(lojaId: string, codigoLido: string) {
    const { sku, eanOuSku } = interpretarCodigoLido(codigoLido);
    const [p] = await this.db.query<{
      sku: string;
      ean: string | null;
      nome: string;
      marca: string | null;
      unidades_embalagem: number | null;
      preco_unidade: string | null;
      preco_atacado: string | null;
      quantidade_atacado: number | null;
      preco_embalagem: string | null;
    }>(
      `SELECT p.sku, p.ean, p.nome, p.marca, p.unidades_embalagem, pl.preco_unidade, pl.preco_atacado, pl.quantidade_atacado, pl.preco_embalagem
       FROM produtos p LEFT JOIN produto_loja pl ON pl.sku = p.sku AND pl.loja_id = $2
       WHERE p.ativo AND ${sku ? 'p.sku = $1' : '(p.ean = $1 OR p.sku = $1)'}`,
      [sku ?? eanOuSku, lojaId],
    );
    if (!p) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Produto não encontrado. Consulte o preço no caixa.');
    const [onde] = await this.db.query<{ rua: string; modulo: string | null; nivel: string | null; posicao: string | null }>(
      `SELECT rua, modulo, nivel, posicao FROM enderecos_produto WHERE sku = $1 AND loja_id = $2 AND tipo = 'venda'
       ORDER BY principal DESC, confirmado_em DESC NULLS LAST LIMIT 1`,
      [p.sku, lojaId],
    );
    return {
      nome: p.nome,
      marca: p.marca,
      ean: p.ean,
      precoUnidade: numero(p.preco_unidade),
      precoAtacado: numero(p.preco_atacado),
      quantidadeAtacado: p.quantidade_atacado,
      precoEmbalagem: numero(p.preco_embalagem),
      unidadesEmbalagem: p.unidades_embalagem,
      onde: onde ? descreverLocal(onde) : null,
    };
  }

  /** Gera a chave de um leitor de preço. Ela aparece só agora; no banco fica apenas o hash. */
  async criarTerminal(sessao: SessaoAtual, dados: CriarTerminalDto) {
    const chave = randomBytes(24).toString('base64url');
    const [t] = await this.db.query<{ id: string }>(
      'INSERT INTO terminais_consulta (loja_id, descricao, rua, chave_hash, criado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [sessao.loja, dados.descricao.trim(), vazioParaNulo(dados.rua), hashChaveTerminal(chave), sessao.sub],
    );
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'terminal.criado', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { terminal: t.id } });
    return { id: t.id, descricao: dados.descricao.trim(), chave };
  }

  async terminais(sessao: SessaoAtual) {
    const linhas = await this.db.query<{ id: string; descricao: string; rua: string | null; criado_em: Date; revogado_em: Date | null }>(
      'SELECT id, descricao, rua, criado_em, revogado_em FROM terminais_consulta WHERE loja_id = $1 ORDER BY revogado_em NULLS FIRST, descricao',
      [sessao.loja],
    );
    return linhas.map((t) => ({ id: t.id, descricao: t.descricao, rua: t.rua, criadoEm: t.criado_em, revogadoEm: t.revogado_em }));
  }

  async revogarTerminal(sessao: SessaoAtual, id: string) {
    if (!/^\d{1,18}$/.test(id)) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'terminal_inexistente', 'Terminal não encontrado.');
    const [t] = await this.db.query<{ id: string }>(
      'UPDATE terminais_consulta SET revogado_em = COALESCE(revogado_em, now()) WHERE id = $1 AND loja_id = $2 RETURNING id',
      [id, sessao.loja],
    );
    if (!t) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'terminal_inexistente', 'Terminal não encontrado.');
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'terminal.revogado', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { terminal: id } });
    return { id, revogado: true };
  }

  private async produto(lido: string) {
    const { sku, eanOuSku } = interpretarCodigoLido(lido);
    const [p] = await this.db.query<{ sku: string; nome: string }>(
      sku ? 'SELECT sku, nome FROM produtos WHERE ativo AND sku = $1' : 'SELECT sku, nome FROM produtos WHERE ativo AND (ean = $1 OR sku = $1)',
      [sku ?? eanOuSku],
    );
    if (!p) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Produto não encontrado no catálogo. Confira o EAN ou peça a importação do ERP.');
    return p;
  }
}
