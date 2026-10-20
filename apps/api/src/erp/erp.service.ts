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
          `INSERT INTO produtos (sku, ean, nome, marca, departamento, ativo) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (sku) DO UPDATE SET ean = EXCLUDED.ean, nome = EXCLUDED.nome, marca = EXCLUDED.marca,
             departamento = EXCLUDED.departamento, ativo = EXCLUDED.ativo
           RETURNING (xmax = 0) AS novo`,
          [p.sku, p.ean ?? null, p.nome, p.marca ?? null, p.departamento, p.ativo ?? true],
          cliente,
        );
        if (linha.novo) novos++;
      }
      return { novos, atualizados: dados.produtos.length - novos };
    });
    await this.auditoria.registrar({ autor: 'erp', acao: 'catalogo.importado', detalhes: { ...resultado } });
    return resultado;
  }
}
