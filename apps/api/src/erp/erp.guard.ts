import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ErroAcesso } from '../auth/acesso.service';
import { CONFIG, Config } from '../config';

const digest = (valor: string) => createHash('sha256').update(valor).digest();

/** Só o sistema de catálogo (ERP), com a chave da integração, envia produtos. Sem ERP_API_KEY a rota fica fechada. */
@Injectable()
export class ChaveErpGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(contexto: ExecutionContext): boolean {
    const chave = contexto.switchToHttp().getRequest<Request>().headers['x-erp-api-key'];
    const esperada = this.config.erpApiKey;
    if (!esperada || typeof chave !== 'string' || !timingSafeEqual(digest(chave), digest(esperada))) {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'chave_erp_invalida', 'Chave da integração do catálogo inválida.');
    }
    return true;
  }
}
