import { HttpStatus, Injectable } from '@nestjs/common';
import { ErroAcesso } from '../auth/acesso.service';
import { DbService } from '../db/db.service';
import { descreverLocal, NOME_TIPO } from '../etiquetas/codigos';
import { calcularIndicadores, hojeNaLoja, interpretarCodigoLido } from './indicadores';

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
  async ficha(lojaId: string, codigoLido: string) {
    const { sku, eanOuSku } = interpretarCodigoLido(codigoLido);
    const [produto] = await this.db.query<{ sku: string; ean: string | null; nome: string; marca: string | null; departamento: string }>(
      sku
        ? 'SELECT sku, ean, nome, marca, departamento FROM produtos WHERE ativo AND sku = $1'
        : 'SELECT sku, ean, nome, marca, departamento FROM produtos WHERE ativo AND (ean = $1 OR sku = $1)',
      [sku ?? eanOuSku],
    );
    if (!produto) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Código inválido ou item descontinuado.');

    const [enderecos, vendas, ultima, apreciacao, lote, caixas] = await Promise.all([
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

    return {
      produto,
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
}
