import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PoolClient } from 'pg';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CONFIG, Config } from '../config';
import { DbService } from '../db/db.service';
import { conferirCodigo } from '../seguranca/codigo-ativacao';
import { conferirPalavra, gerarHashPalavra, validarPalavraSecreta } from '../seguranca/palavra-secreta';
import { bloqueadoAte, LIMITE_FALHAS_APARELHO, LIMITE_FALHAS_MATRICULA, Tentativa } from './bloqueio';
import { Aparelho, Colaborador, Sessao } from './tipos';

export type TipoTentativa = 'ativacao' | 'login';

export interface RespostaAcesso {
  token: string;
  colaborador: { matricula: string; nome: string; papel: string; lojaId: string };
}

export class ErroAcesso extends HttpException {
  constructor(status: HttpStatus, readonly motivo: string, mensagem: string) {
    super({ motivo, mensagem }, status);
  }
}

const MENSAGEM_BLOQUEIO = 'Acesso bloqueado por 15 minutos depois de várias tentativas erradas. O líder foi avisado.';

@Injectable()
export class AcessoService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Primeiro acesso: matrícula do RH + código do líder + palavra secreta nova. */
  async ativar(dados: { matricula: string; codigo: string; palavraSecreta: string; aparelhoId: string }): Promise<RespostaAcesso> {
    const { matricula, aparelhoId } = dados;
    const aparelho = await this.prepararTentativa(matricula, aparelhoId, 'ativacao');
    const colaborador = await this.colaboradorDaLoja(matricula, aparelho, 'ativacao');

    if (colaborador.palavra_hash) {
      throw new ErroAcesso(HttpStatus.CONFLICT, 'ja_ativado', 'Esta matrícula já está ativa. Use "Esqueci minha palavra" com o seu líder.');
    }

    const codigos = await this.db.query<{ id: string; codigo_hash: string }>(
      'SELECT id, codigo_hash FROM codigos_ativacao WHERE matricula = $1 AND usado_em IS NULL AND expira_em > now() ORDER BY criado_em DESC',
      [matricula],
    );
    const valido = codigos.find((c) => conferirCodigo(dados.codigo, matricula, this.config.jwtSecret, c.codigo_hash));
    if (!valido) {
      await this.falhar(matricula, aparelho, 'ativacao', 'codigo_invalido', HttpStatus.UNAUTHORIZED, 'Código inválido ou vencido. Peça um novo ao seu líder.');
    }

    // Erro de regra da palavra não conta como tentativa errada: a pessoa já provou quem é com o código.
    const recusa = validarPalavraSecreta(dados.palavraSecreta, colaborador);
    if (recusa) throw new ErroAcesso(HttpStatus.BAD_REQUEST, 'palavra_fraca', recusa);

    const hash = await gerarHashPalavra(dados.palavraSecreta);
    const atualizado = await this.db.transacao(async (cliente) => {
      // usado_em IS NULL garante uso único mesmo com duas ativações simultâneas.
      const usados = await cliente.query('UPDATE codigos_ativacao SET usado_em = now() WHERE id = $1 AND usado_em IS NULL', [valido!.id]);
      if (usados.rowCount !== 1) {
        throw new ErroAcesso(HttpStatus.UNAUTHORIZED, 'codigo_invalido', 'Código inválido ou vencido. Peça um novo ao seu líder.');
      }
      const [linha] = (
        await cliente.query<Colaborador>(
          `UPDATE colaboradores SET palavra_hash = $2, ativado_em = now(), versao_token = versao_token + 1, atualizado_em = now()
           WHERE matricula = $1 RETURNING *`,
          [matricula, hash],
        )
      ).rows;
      await this.registrarTentativa(cliente, matricula, aparelho, 'ativacao', true, null);
      await this.auditoria.registrar({ autor: matricula, acao: 'acesso.ativado', lojaId: aparelho.loja_id, aparelhoId: aparelho.id }, cliente);
      return linha;
    });

    return this.emitirSessao(atualizado, aparelho);
  }

  async entrar(dados: { matricula: string; palavraSecreta: string; aparelhoId: string }): Promise<RespostaAcesso> {
    const { matricula, aparelhoId } = dados;
    const aparelho = await this.prepararTentativa(matricula, aparelhoId, 'login');
    const colaborador = await this.colaboradorDaLoja(matricula, aparelho, 'login');

    if (!colaborador.palavra_hash) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'nao_ativado', 'Esta matrícula ainda não foi ativada. Toque em "Primeiro acesso".');
    }
    if (!(await conferirPalavra(dados.palavraSecreta, colaborador.palavra_hash))) {
      await this.falhar(matricula, aparelho, 'login', 'palavra_errada', HttpStatus.UNAUTHORIZED, 'Matrícula ou palavra secreta incorreta.');
    }

    await this.registrarTentativa(this.db.pool, matricula, aparelho, 'login', true, null);
    return this.emitirSessao(colaborador, aparelho);
  }

  /** Confere aparelho e bloqueios antes de olhar qualquer dado do colaborador. */
  private async prepararTentativa(matricula: string, aparelhoId: string, tipo: TipoTentativa): Promise<Aparelho> {
    const [aparelho] = await this.db.query<Aparelho>('SELECT * FROM aparelhos WHERE id = $1', [aparelhoId]);
    if (!aparelho || !aparelho.ativo) {
      await this.registrarTentativa(this.db.pool, matricula, { id: aparelhoId, loja_id: null }, tipo, false, 'aparelho_nao_autorizado');
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'aparelho_nao_autorizado', 'Este aparelho não está autorizado. Use um celular da loja.');
    }

    const agora = new Date();
    const porMatricula = await this.db.query<Tentativa>(
      'SELECT sucesso, criado_em FROM tentativas_acesso WHERE matricula = $1 ORDER BY criado_em DESC LIMIT 20',
      [matricula],
    );
    const porAparelho = await this.db.query<Tentativa>(
      'SELECT sucesso, criado_em FROM tentativas_acesso WHERE aparelho_id = $1 ORDER BY criado_em DESC LIMIT 20',
      [aparelho.id],
    );
    if (bloqueadoAte(porMatricula, LIMITE_FALHAS_MATRICULA, agora) || bloqueadoAte(porAparelho, LIMITE_FALHAS_APARELHO, agora)) {
      await this.registrarTentativa(this.db.pool, matricula, aparelho, tipo, false, 'bloqueado');
      throw new ErroAcesso(HttpStatus.TOO_MANY_REQUESTS, 'bloqueado', MENSAGEM_BLOQUEIO);
    }
    return aparelho;
  }

  /** A matrícula precisa existir no cadastro do RH, estar ativa e ser da mesma loja do aparelho. */
  private async colaboradorDaLoja(matricula: string, aparelho: Aparelho, tipo: TipoTentativa): Promise<Colaborador> {
    const [colaborador] = await this.db.query<Colaborador>('SELECT * FROM colaboradores WHERE matricula = $1', [matricula]);
    if (!colaborador || !colaborador.ativo_no_rh) {
      await this.falhar(matricula, aparelho, tipo, 'matricula_inexistente', HttpStatus.UNAUTHORIZED,
        'Matrícula não encontrada no cadastro do RH. Só o RH cria matrículas; fale com o seu líder.');
    }
    if (colaborador.loja_id !== aparelho.loja_id) {
      await this.falhar(matricula, aparelho, tipo, 'loja_diferente', HttpStatus.FORBIDDEN, 'Esta matrícula não pertence à loja deste aparelho.');
    }
    return colaborador;
  }

  private async falhar(
    matricula: string,
    aparelho: Aparelho,
    tipo: TipoTentativa,
    motivo: string,
    status: HttpStatus,
    mensagem: string,
  ): Promise<never> {
    await this.registrarTentativa(this.db.pool, matricula, aparelho, tipo, false, motivo);

    const tentativas = await this.db.query<Tentativa>(
      'SELECT sucesso, criado_em FROM tentativas_acesso WHERE matricula = $1 ORDER BY criado_em DESC LIMIT 20',
      [matricula],
    );
    if (bloqueadoAte(tentativas, LIMITE_FALHAS_MATRICULA, new Date())) {
      await this.db.query('INSERT INTO avisos_lider (loja_id, tipo, texto) VALUES ($1, $2, $3)', [
        aparelho.loja_id,
        'acesso_bloqueado',
        `Matrícula ${matricula} bloqueada por 15 minutos após ${LIMITE_FALHAS_MATRICULA} tentativas erradas no aparelho ${aparelho.descricao}.`,
      ]);
      throw new ErroAcesso(HttpStatus.TOO_MANY_REQUESTS, 'bloqueado', MENSAGEM_BLOQUEIO);
    }
    throw new ErroAcesso(status, motivo, mensagem);
  }

  private async registrarTentativa(
    executor: Pick<PoolClient, 'query'>,
    matricula: string,
    aparelho: { id: string; loja_id: string | null },
    tipo: TipoTentativa,
    sucesso: boolean,
    motivo: string | null,
  ): Promise<void> {
    await executor.query(
      'INSERT INTO tentativas_acesso (matricula, loja_id, aparelho_id, tipo, sucesso, motivo) VALUES ($1, $2, $3, $4, $5, $6)',
      [matricula, aparelho.loja_id, aparelho.id, tipo, sucesso, motivo],
    );
  }

  private async emitirSessao(colaborador: Colaborador, aparelho: Aparelho): Promise<RespostaAcesso> {
    const sessao: Sessao = {
      sub: colaborador.matricula,
      loja: colaborador.loja_id,
      papel: colaborador.papel,
      tv: colaborador.versao_token,
      ap: aparelho.id,
    };
    return {
      token: await this.jwt.signAsync(sessao),
      colaborador: { matricula: colaborador.matricula, nome: colaborador.nome, papel: colaborador.papel, lojaId: colaborador.loja_id },
    };
  }
}
