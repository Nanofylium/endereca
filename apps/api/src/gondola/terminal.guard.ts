import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { ErroAcesso } from '../auth/acesso.service';
import { DbService } from '../db/db.service';

export const CABECALHO_TERMINAL = 'x-terminal-chave';
export const hashChaveTerminal = (chave: string) => createHash('sha256').update(chave).digest('hex');

export interface RequisicaoTerminal extends Request {
  terminal: { id: string; lojaId: string };
}

/** Leitor de preço da área de venda: entra com a chave que o gerente gerou, sem matrícula. */
@Injectable()
export class TerminalGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoTerminal>();
    const chave = req.headers[CABECALHO_TERMINAL];
    if (typeof chave !== 'string' || chave.length < 20 || chave.length > 100) {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'terminal_invalido', 'Terminal de consulta não autorizado.');
    }
    const [t] = await this.db.query<{ id: string; loja_id: string }>(
      'SELECT id, loja_id FROM terminais_consulta WHERE chave_hash = $1 AND revogado_em IS NULL',
      [hashChaveTerminal(chave)],
    );
    if (!t) throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'terminal_invalido', 'Terminal de consulta não autorizado.');
    req.terminal = { id: t.id, lojaId: t.loja_id };
    return true;
  }
}
