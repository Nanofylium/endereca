import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DbService } from '../db/db.service';
import { ImportacaoErpDto } from './erp.dto';

/** O catálogo vem do ERP pelo SKU e EAN; ninguém cadastra produto à mão na loja. */
@Injectable()
export class ErpService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async importar(dados: ImportacaoErpDto): Promise<{ novos: number; atualizados: number }> {
    const resultado = await this.db.transacao(async (cliente) => {
      let novos = 0;
      for (const p of dados.produtos) {
        const [linha] = await this.db.query<{ novo: boolean }>(
          `INSERT INTO produtos (sku, ean, nome, marca, departamento, ativo, codigo_interno, classe, setor_save,
             unidades_embalagem, lastro, altura, vida_util_dias)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (sku) DO UPDATE SET ean = EXCLUDED.ean, nome = EXCLUDED.nome, marca = EXCLUDED.marca,
             departamento = EXCLUDED.departamento, ativo = EXCLUDED.ativo, codigo_interno = EXCLUDED.codigo_interno,
             classe = EXCLUDED.classe, setor_save = EXCLUDED.setor_save, unidades_embalagem = EXCLUDED.unidades_embalagem,
             lastro = EXCLUDED.lastro, altura = EXCLUDED.altura, vida_util_dias = EXCLUDED.vida_util_dias
           RETURNING (xmax = 0) AS novo`,
          [
            p.sku,
            p.ean ?? null,
            p.nome,
            p.marca ?? null,
            p.departamento,
            p.ativo ?? true,
            p.codigoInterno ?? null,
            p.classe ?? null,
            p.setorSave ?? null,
            p.unidadesEmbalagem ?? null,
            p.lastro ?? null,
            p.altura ?? null,
            p.vidaUtilDias ?? null,
          ],
          cliente,
        );
        if (linha.novo) novos++;

        if (p.conjuntos) {
          await this.db.query('DELETE FROM conjuntos_produto WHERE sku = $1', [p.sku], cliente);
          for (const c of p.conjuntos) {
            await this.db.query(
              `INSERT INTO conjuntos_produto (codigo, nome, sku, quantidade) VALUES ($1, $2, $3, $4)
               ON CONFLICT (codigo, sku) DO UPDATE SET nome = EXCLUDED.nome, quantidade = EXCLUDED.quantidade`,
              [c.codigo, c.nome, p.sku, c.quantidade],
              cliente,
            );
          }
        }

        // Loja que o RH ainda não sincronizou fica de fora em vez de derrubar a importação inteira.
        for (const l of p.lojas ?? []) {
          await this.db.query(
            `INSERT INTO produto_loja (sku, loja_id, preco_unidade, preco_embalagem, ultima_compra_em, ultima_compra_quantidade, preco_atacado, quantidade_atacado)
             SELECT $1, id, $3, $4, $5, $6, $7, $8 FROM lojas WHERE id = $2
             ON CONFLICT (sku, loja_id) DO UPDATE SET preco_unidade = EXCLUDED.preco_unidade, preco_embalagem = EXCLUDED.preco_embalagem,
               ultima_compra_em = EXCLUDED.ultima_compra_em, ultima_compra_quantidade = EXCLUDED.ultima_compra_quantidade,
               preco_atacado = EXCLUDED.preco_atacado, quantidade_atacado = EXCLUDED.quantidade_atacado, atualizado_em = now()`,
            [
              p.sku,
              l.lojaId,
              l.precoUnidade ?? null,
              l.precoEmbalagem ?? null,
              l.ultimaCompraEm ?? null,
              l.ultimaCompraQuantidade ?? null,
              l.precoAtacado ?? null,
              l.quantidadeAtacado ?? null,
            ],
            cliente,
          );
        }
      }
      return { novos, atualizados: dados.produtos.length - novos };
    });
    await this.auditoria.registrar({ autor: 'erp', acao: 'catalogo.importado', detalhes: { ...resultado } });
    return resultado;
  }
}
