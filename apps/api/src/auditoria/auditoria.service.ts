import { Injectable } from '@nestjs/common';
import { DbService, Executor } from '../db/db.service';

export interface EventoAuditoria {
  autor: string;
  acao: string;
  lojaId?: string | null;
  aparelhoId?: string | null;
  detalhes?: Record<string, unknown>;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly db: DbService) {}

  async registrar(evento: EventoAuditoria, executor?: Executor): Promise<void> {
    await this.db.query(
      'INSERT INTO auditoria (autor, acao, loja_id, aparelho_id, detalhes) VALUES ($1, $2, $3, $4, $5)',
      [evento.autor, evento.acao, evento.lojaId ?? null, evento.aparelhoId ?? null, JSON.stringify(evento.detalhes ?? {})],
      executor,
    );
  }
}
