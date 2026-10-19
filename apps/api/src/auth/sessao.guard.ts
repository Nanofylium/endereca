import { CanActivate, ExecutionContext, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DbService } from '../db/db.service';
import { ErroAcesso } from './acesso.service';
import { Papel, Sessao } from './tipos';

export const CABECALHO_APARELHO = 'x-aparelho-id';
const PAPEIS = 'papeis';

/** Restringe a rota aos papéis informados. Sem o decorator, qualquer sessão válida passa. */
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

export interface RequisicaoAutenticada extends Request {
  sessao: Sessao;
}

/**
 * Exige token válido, do mesmo aparelho, de um colaborador ainda ativo no RH
 * e com a versão de token atual (desligamento ou nova ativação derrubam sessões antigas).
 */
@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DbService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'sem_sessao', 'Entre novamente.');

    let sessao: Sessao;
    try {
      sessao = await this.jwt.verifyAsync<Sessao>(token);
    } catch {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'sessao_expirada', 'Sua sessão expirou. Entre novamente.');
    }

    if (req.headers[CABECALHO_APARELHO] !== sessao.ap) {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'aparelho_diferente', 'Sessão aberta em outro aparelho. Entre novamente.');
    }

    const [atual] = await this.db.query<{ ativo_no_rh: boolean; versao_token: number; aparelho_ativo: boolean | null }>(
      `SELECT c.ativo_no_rh, c.versao_token, a.ativo AS aparelho_ativo
       FROM colaboradores c LEFT JOIN aparelhos a ON a.id = $2
       WHERE c.matricula = $1`,
      [sessao.sub, sessao.ap],
    );
    if (!atual || !atual.ativo_no_rh || atual.versao_token !== sessao.tv || !atual.aparelho_ativo) {
      throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'sessao_revogada', 'Seu acesso foi encerrado. Fale com o seu líder.');
    }

    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS, [contexto.getHandler(), contexto.getClass()]);
    if (papeis && !papeis.includes(sessao.papel)) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'sem_permissao', 'Você não tem permissão para esta ação.');
    }

    req.sessao = sessao;
    return true;
  }
}
