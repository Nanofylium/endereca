import { HttpStatus, Injectable } from '@nestjs/common';
import { ErroAcesso } from '../auth/acesso.service';
import { DbService } from '../db/db.service';
import { descreverLocal, NOME_TIPO } from '../etiquetas/codigos';
import { calcularIndicadores, FUSO_LOJA, hojeNaLoja, interpretarCodigoLido } from './indicadores';

interface LinhaProduto {
  sku: string;
  ean: string | null;
  nome: string;
  marca: string | null;
  departamento: string;
  codigo_interno: string | null;
  classe: string | null;
  setor_save: string | null;
  unidades_embalagem: number | null;
  lastro: number | null;
  altura: number | null;
  vida_util_dias: number | null;
}

const COLUNAS_PRODUTO = `sku, ean, nome, marca, departamento, codigo_interno, classe, setor_save,
  unidades_embalagem, lastro, altura, vida_util_dias`;

interface LinhaEndereco {
  tipo: string;
  rua: string;
  modulo: string | null;
  nivel: string | null;
  posicao: string | null;
  quantidade: number | null;
  principal: boolean;
  confirmado_em: Date | null;
  confirmado_por: string | null;
}

@Injectable()
export class ProdutosService {
  constructor(private readonly db: DbService) {}

  async buscar(lojaId: string, termo: string) {
    const t = termo.trim();
    if (t.length < 2) return [];
    return this.db.query<{ sku: string; ean: string | null; nome: string; departamento: string }>(
      `SELECT p.sku, p.ean, p.nome, p.departamento
       FROM produtos p
       WHERE p.ativo AND (p.sku = $2 OR p.ean = $2 OR p.nome ILIKE '%' || $3 || '%' OR p.marca ILIKE '%' || $3 || '%')
         AND EXISTS (SELECT 1 FROM enderecos_produto e WHERE e.sku = p.sku AND e.loja_id = $1)
       ORDER BY p.nome
       LIMIT 20`,
      [lojaId, t, t.replace(/[%_\\]/g, '\\$&')],
    );
  }

  /** Ficha completa: o que o repositor vê ao ler o QR Code ou o código de barras. */
  async ficha(lojaId: string, matricula: string, codigoLido: string) {
    const { sku, eanOuSku } = interpretarCodigoLido(codigoLido);
    const [produto] = await this.db.query<LinhaProduto>(
      sku
        ? `SELECT ${COLUNAS_PRODUTO} FROM produtos WHERE ativo AND sku = $1`
        : `SELECT ${COLUNAS_PRODUTO} FROM produtos WHERE ativo AND (ean = $1 OR sku = $1)`,
      [sku ?? eanOuSku],
    );
    if (!produto) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Código inválido ou item descontinuado.');

    const forma = sku ? 'qr' : produto.ean !== null && produto.ean === eanOuSku ? 'ean' : 'sku';
    const leitura = await this.registrarLeitura(lojaId, matricula, produto.sku, forma);

    const [enderecos, vendas, ultima, apreciacao, lote, caixas, porLoja, conjuntos, maisAntiga] = await Promise.all([
      this.db.query<LinhaEndereco>(
        `SELECT tipo, rua, modulo, nivel, posicao, quantidade, principal, confirmado_em, confirmado_por
         FROM enderecos_produto WHERE sku = $1 AND loja_id = $2
         ORDER BY (tipo = 'venda') DESC, principal DESC, confirmado_em DESC NULLS LAST`,
        [produto.sku, lojaId],
      ),
      this.db.query<{ dia: string; unidades: number }>(
        "SELECT dia, unidades FROM vendas_diarias WHERE sku = $1 AND loja_id = $2 AND dia > $3::date - 7 AND dia <= $3::date",
        [produto.sku, lojaId, hojeNaLoja()],
      ),
      this.db.query<{ dia: string | null }>(
        'SELECT max(dia) AS dia FROM vendas_diarias WHERE sku = $1 AND loja_id = $2 AND unidades > 0',
        [produto.sku, lojaId],
      ),
      this.db.query<{ nota: string; calculado_em: Date }>('SELECT nota, calculado_em FROM apreciacao_produto WHERE sku = $1 AND loja_id = $2', [
        produto.sku,
        lojaId,
      ]),
      this.db.query<{ lote: string; validade: string | null; fornecedor: string | null; proxima_entrega: Date | null }>(
        `SELECT lote, validade, fornecedor, proxima_entrega FROM lotes_produto
         WHERE sku = $1 AND loja_id = $2 ORDER BY validade ASC NULLS LAST LIMIT 1`,
        [produto.sku, lojaId],
      ),
      // Caixas guardadas, na ordem em que devem sair: validade mais próxima primeiro, depois a que chegou antes.
      this.db.query<{
        codigo: string;
        quantidade: number;
        lote: string | null;
        validade: string | null;
        recebido_em: Date;
        tipo: string;
        rua: string;
        modulo: string | null;
        nivel: string | null;
        posicao: string | null;
      }>(
        `SELECT v.codigo, v.quantidade, v.lote, v.validade, v.recebido_em, l.tipo, l.rua, l.modulo, l.nivel, l.posicao
         FROM volumes v JOIN locais l ON l.id = v.local_id
         WHERE v.sku = $1 AND v.loja_id = $2 AND v.baixado_em IS NULL AND l.tipo <> 'venda'
         ORDER BY v.validade ASC NULLS LAST, v.recebido_em, v.id
         LIMIT 50`,
        [produto.sku, lojaId],
      ),
      this.db.query<{
        preco_unidade: string | null;
        preco_embalagem: string | null;
        ultima_compra_em: string | null;
        ultima_compra_quantidade: number | null;
        atualizado_em: Date;
      }>(
        `SELECT preco_unidade, preco_embalagem, to_char(ultima_compra_em, 'YYYY-MM-DD') AS ultima_compra_em, ultima_compra_quantidade, atualizado_em
         FROM produto_loja WHERE sku = $1 AND loja_id = $2`,
        [produto.sku, lojaId],
      ),
      this.db.query<{ codigo: string; nome: string; quantidade: number }>(
        'SELECT codigo, nome, quantidade FROM conjuntos_produto WHERE sku = $1 ORDER BY nome',
        [produto.sku],
      ),
      // Idade do estoque: há quantos dias chegou a caixa mais antiga que ainda não acabou.
      this.db.query<{ desde: Date | null }>(
        'SELECT min(recebido_em) AS desde FROM volumes WHERE sku = $1 AND loja_id = $2 AND baixado_em IS NULL',
        [produto.sku, lojaId],
      ),
    ]);

    const formatar = (e: LinhaEndereco) => ({
      tipo: e.tipo,
      rua: e.rua,
      modulo: e.modulo,
      nivel: e.nivel,
      posicao: e.posicao,
      quantidade: e.quantidade,
      confirmadoEm: e.confirmado_em,
      confirmadoPor: e.confirmado_por,
    });
    const venda = enderecos.filter((e) => e.tipo === 'venda');
    const estoque = enderecos.filter((e) => e.tipo !== 'venda');
    const quantidadeGondola = venda.some((e) => e.quantidade !== null) ? venda.reduce((s, e) => s + (e.quantidade ?? 0), 0) : null;

    const somaOuNulo = (lista: LinhaEndereco[]) =>
      lista.some((e) => e.quantidade !== null) ? lista.reduce((soma, e) => soma + (e.quantidade ?? 0), 0) : null;
    const quantidadeEstoque = somaOuNulo(estoque);
    const totalUnidades = somaOuNulo(enderecos);
    const preco = porLoja[0];
    const hoje = hojeNaLoja();
    const desde = maisAntiga[0]?.desde ?? null;

    return {
      produto: {
        sku: produto.sku,
        ean: produto.ean,
        nome: produto.nome,
        marca: produto.marca,
        departamento: produto.departamento,
        codigoInterno: produto.codigo_interno,
        classe: produto.classe,
        setorSave: produto.setor_save,
        unidadesEmbalagem: produto.unidades_embalagem,
        lastro: produto.lastro,
        altura: produto.altura,
        vidaUtilDias: produto.vida_util_dias,
      },
      leitura,
      estoqueTotal: {
        unidades: totalUnidades,
        gondola: quantidadeGondola,
        estoque: quantidadeEstoque,
        embalagens: totalUnidades !== null && produto.unidades_embalagem ? Math.floor(totalUnidades / produto.unidades_embalagem) : null,
      },
      preco: preco
        ? {
            unidade: preco.preco_unidade === null ? null : Number(preco.preco_unidade),
            embalagem: preco.preco_embalagem === null ? null : Number(preco.preco_embalagem),
            atualizadoEm: preco.atualizado_em,
          }
        : null,
      ultimaCompra: preco?.ultima_compra_em ? { data: preco.ultima_compra_em, quantidade: preco.ultima_compra_quantidade } : null,
      ultimaVenda: ultima[0]?.dia ?? null,
      palete:
        produto.lastro && produto.altura
          ? {
              lastro: produto.lastro,
              altura: produto.altura,
              caixas: produto.lastro * produto.altura,
              unidades: produto.unidades_embalagem ? produto.lastro * produto.altura * produto.unidades_embalagem : null,
            }
          : null,
      idadeEstoque: desde ? { desde, dias: Math.max(0, diasDesde(desde, hoje)) } : null,
      conjuntos,
      areaDeVenda: venda.map(formatar),
      quantidadeGondola,
      estoque: estoque.map(formatar),
      apreciacao: apreciacao[0] ? { nota: Number(apreciacao[0].nota), calculadoEm: apreciacao[0].calculado_em } : null,
      ...calcularIndicadores(vendas, ultima[0]?.dia ?? null, quantidadeGondola, hojeNaLoja()),
      lote: lote[0]
        ? { lote: lote[0].lote, validade: lote[0].validade, fornecedor: lote[0].fornecedor, proximaEntrega: lote[0].proxima_entrega }
        : null,
      caixas: caixas.map((c) => ({
        codigo: c.codigo,
        quantidade: c.quantidade,
        lote: c.lote,
        validade: c.validade,
        recebidoEm: c.recebido_em,
        nomeTipo: NOME_TIPO[c.tipo] ?? c.tipo,
        descricao: descreverLocal(c),
      })),
    };
  }

  /** Grava a leitura e devolve quantas houve hoje e quem bipou antes. */
  private async registrarLeitura(lojaId: string, matricula: string, sku: string, forma: 'qr' | 'ean' | 'sku') {
    return this.db.transacao(async (cliente) => {
      const [anterior] = await this.db.query<{ lido_em: Date; nome: string | null }>(
        `SELECT l.lido_em, c.nome FROM leituras_produto l LEFT JOIN colaboradores c ON c.matricula = l.matricula
         WHERE l.loja_id = $1 AND l.sku = $2 ORDER BY l.lido_em DESC, l.id DESC LIMIT 1`,
        [lojaId, sku],
        cliente,
      );
      const [agora] = await this.db.query<{ lido_em: Date; hoje: number }>(
        `WITH nova AS (
           INSERT INTO leituras_produto (sku, loja_id, matricula, forma) VALUES ($1, $2, $3, $4) RETURNING lido_em
         )
         SELECT nova.lido_em,
           (SELECT count(*)::int + 1 FROM leituras_produto
            WHERE loja_id = $2 AND sku = $1 AND lido_em >= ($5::date)::timestamp AT TIME ZONE '${FUSO_LOJA}') AS hoje
         FROM nova`,
        [sku, lojaId, matricula, forma, hojeNaLoja()],
        cliente,
      );
      return {
        forma,
        em: agora.lido_em,
        leiturasHoje: agora.hoje,
        anterior: anterior ? { em: anterior.lido_em, nome: anterior.nome } : null,
      };
    });
  }
}

/** Dias inteiros entre a data (no fuso da loja) e hoje. */
function diasDesde(data: Date, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${hojeNaLoja(data)}T00:00:00Z`)) / 86_400_000);
}
