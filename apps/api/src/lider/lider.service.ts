import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErroAcesso } from '../auth/acesso.service';
import { Colaborador, Sessao } from '../auth/tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CONFIG, Config } from '../config';
import { DbService } from '../db/db.service';
import { emitirCodigo } from './emitir-codigo';

@Injectable()
export class LiderService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Novos colaboradores da loja que vieram do RH e ainda não ativaram o acesso. */
  async pendentes(sessao: Sessao) {
    return this.db.query<{ matricula: string; nome: string; papel: string; codigo_valido_ate: Date | null }>(
      `SELECT c.matricula, c.nome, c.papel,
              (SELECT max(expira_em) FROM codigos_ativacao k WHERE k.matricula = c.matricula AND k.usado_em IS NULL AND k.expira_em > now()) AS codigo_valido_ate
       FROM colaboradores c
       WHERE c.loja_id = $1 AND c.ativo_no_rh AND c.palavra_hash IS NULL
       ORDER BY c.nome`,
      [sessao.loja],
    );
  }

  /**
   * Gera o código de primeiro acesso. Ele é mostrado uma única vez ao líder, que o entrega em mãos;
   * o banco guarda só o HMAC. Gerar um novo invalida os anteriores.
   */
  async gerarCodigo(sessao: Sessao, matricula: string): Promise<{ matricula: string; nome: string; codigo: string; expiraEm: Date }> {
    const [colaborador] = await this.db.query<Colaborador>('SELECT * FROM colaboradores WHERE matricula = $1', [matricula]);
    if (!colaborador || !colaborador.ativo_no_rh || colaborador.loja_id !== sessao.loja) {
      throw new ErroAcesso(HttpStatus.NOT_FOUND, 'matricula_inexistente', 'Matrícula não encontrada no cadastro do RH desta loja.');
    }
    if (colaborador.palavra_hash) {
      throw new ErroAcesso(HttpStatus.CONFLICT, 'ja_ativado', 'Esta matrícula já está ativa.');
    }
    if (colaborador.matricula === sessao.sub) {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'auto_ativacao', 'Peça o seu código a outro líder ou administrador.');
    }
    if (colaborador.papel !== 'repositor' && sessao.papel !== 'admin') {
      throw new ErroAcesso(HttpStatus.FORBIDDEN, 'sem_permissao', 'Só um administrador libera o acesso de líderes.');
    }

    const { codigo, expiraEm } = await this.db.transacao(async (cliente) => {
      const emitido = await emitirCodigo(cliente, matricula, sessao.sub, this.config.jwtSecret);
      await this.auditoria.registrar(
        { autor: sessao.sub, acao: 'codigo_ativacao.gerado', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { matricula } },
        cliente,
      );
      return emitido;
    });
    return { matricula, nome: colaborador.nome, codigo, expiraEm };
  }

  async tentativasRecusadas(sessao: Sessao, desde: Date) {
    return this.db.query<{ matricula: string; aparelho_id: string | null; tipo: string; motivo: string; criado_em: Date }>(
      `SELECT matricula, aparelho_id, tipo, motivo, criado_em
       FROM tentativas_acesso
       WHERE NOT sucesso AND criado_em >= $2
         AND (loja_id = $1 OR matricula IN (SELECT matricula FROM colaboradores WHERE loja_id = $1))
       ORDER BY criado_em DESC
       LIMIT 200`,
      [sessao.loja, desde],
    );
  }

  async avisos(sessao: Sessao) {
    return this.db.query<{ id: string; tipo: string; texto: string; criado_em: Date }>(
      'SELECT id, tipo, texto, criado_em FROM avisos_lider WHERE loja_id = $1 ORDER BY criado_em DESC LIMIT 50',
      [sessao.loja],
    );
  }
}
