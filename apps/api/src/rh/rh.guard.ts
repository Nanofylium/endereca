import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ErroAcesso } from '../auth/acesso.service';
import { CONFIG, Config } from '../config';

const digest = (valor: string) => createHash('sha256').update(valor).digest();

/** Só o sistema do RH, com a chave da integração, pode chamar estas rotas. */
@Injectable()
export class ChaveRhGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(contexto: ExecutionContext): boolean {
    const chave = contexto.switchToHttp().getRequest<Request>().headers['x-rh-api-key'];
    if (typeof chave !== 'string' || !timingSafeEqual(digest(chave), digest(this.config.rhApiKey))) {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'chave_rh_invalida', 'Chave da integração do RH inválida.');
    }
    return true;
  }
}
