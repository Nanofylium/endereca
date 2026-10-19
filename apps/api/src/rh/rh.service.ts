import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DbService } from '../db/db.service';
import { SincronizacaoRhDto } from './rh.dto';

export interface ResultadoSincronizacao {
  novos: number;
  atualizados: number;
  desligados: number;
}

/** Única porta de entrada de matrículas no sistema. */
@Injectable()
export class RhService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async sincronizar(dados: SincronizacaoRhDto): Promise<ResultadoSincronizacao> {
    return this.db.transacao(async (cliente) => {
      for (const loja of dados.lojas ?? []) {
        await cliente.query('INSERT INTO lojas (id, nome) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome', [loja.id, loja.nome]);
      }

      const resultado: ResultadoSincronizacao = { novos: 0, atualizados: 0, desligados: 0 };
      for (const c of dados.colaboradores) {
        const [anterior] = (
          await cliente.query<{ ativo_no_rh: boolean }>('SELECT ativo_no_rh FROM colaboradores WHERE matricula = $1 FOR UPDATE', [c.matricula])
        ).rows;
        const desligando = anterior?.ativo_no_rh === true && !c.ativo;

        // Desligar incrementa versao_token: todas as sessões abertas caem na próxima requisição.
        await cliente.query(
          `INSERT INTO colaboradores (matricula, nome, loja_id, papel, ativo_no_rh)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (matricula) DO UPDATE SET
             nome = EXCLUDED.nome, loja_id = EXCLUDED.loja_id, papel = EXCLUDED.papel, ativo_no_rh = EXCLUDED.ativo_no_rh,
             versao_token = colaboradores.versao_token + CASE WHEN $6 THEN 1 ELSE 0 END,
             atualizado_em = now()`,
          [c.matricula, c.nome, c.lojaId, c.papel, c.ativo, desligando],
        );

        if (desligando) {
          resultado.desligados++;
          await cliente.query('UPDATE codigos_ativacao SET expira_em = now() WHERE matricula = $1 AND usado_em IS NULL', [c.matricula]);
          await this.auditoria.registrar({ autor: 'rh', acao: 'colaborador.desligado', lojaId: c.lojaId, detalhes: { matricula: c.matricula } }, cliente);
        } else if (anterior) {
          resultado.atualizados++;
        } else {
          resultado.novos++;
          await this.auditoria.registrar({ autor: 'rh', acao: 'colaborador.criado', lojaId: c.lojaId, detalhes: { matricula: c.matricula } }, cliente);
        }
      }
      return resultado;
    });
  }
}
