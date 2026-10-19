import { HttpStatus, Injectable } from '@nestjs/common';
import { ErroAcesso } from '../auth/acesso.service';
import { SessaoAtual } from '../auth/tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DbService } from '../db/db.service';
import { LiderService } from '../lider/lider.service';

const SEM_SETOR = 'Sem setor';

export interface ResumoSetor {
  setor: string;
  lideres: string[];
  total: number;
  ativos: number;
  pendentes: number;
  bloqueados: number;
  produtosEmAlerta: number;
}

/** Visão do gerente operacional: todos os setores da loja e os aparelhos autorizados. */
@Injectable()
export class GerenteService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
    private readonly lider: LiderService,
  ) {}

  async setores(sessao: SessaoAtual): Promise<ResumoSetor[]> {
    const [equipe, alertas] = await Promise.all([this.lider.equipe(sessao), this.lider.produtosEmAlerta(sessao)]);
    const chave = (s: string | null) => s?.trim() || SEM_SETOR;
    const resumos = new Map<string, ResumoSetor>();
    const obter = (setor: string) => {
      const nome = resumos.get(setor.toLocaleLowerCase('pt-BR'));
      if (nome) return nome;
      const novo: ResumoSetor = { setor, lideres: [], total: 0, ativos: 0, pendentes: 0, bloqueados: 0, produtosEmAlerta: 0 };
      resumos.set(setor.toLocaleLowerCase('pt-BR'), novo);
      return novo;
    };

    for (const m of equipe) {
      if (m.papel === 'gerente' || m.papel === 'admin') continue;
      const r = obter(chave(m.setor));
      if (m.papel === 'lider') r.lideres.push(m.nome);
      r.total++;
      if (m.situacao === 'ativo') r.ativos++;
      else if (m.situacao === 'pendente') r.pendentes++;
      else r.bloqueados++;
    }
    for (const p of alertas) obter(chave(p.departamento)).produtosEmAlerta++;

    return [...resumos.values()].sort((a, b) => (a.setor === SEM_SETOR ? 1 : b.setor === SEM_SETOR ? -1 : a.setor.localeCompare(b.setor, 'pt-BR')));
  }

  async aparelhos(sessao: SessaoAtual) {
    return this.db.query<{ id: string; descricao: string; ativo: boolean; bloqueado_por: string | null; bloqueado_em: Date | null; ultimo_uso: Date | null }>(
      `SELECT a.id, a.descricao, a.ativo, a.bloqueado_por, a.bloqueado_em,
              (SELECT max(t.criado_em) FROM tentativas_acesso t WHERE t.aparelho_id = a.id AND t.sucesso) AS ultimo_uso
       FROM aparelhos a WHERE a.loja_id = $1 ORDER BY a.ativo DESC, a.descricao`,
      [sessao.loja],
    );
  }

  /** Aparelho perdido ou roubado: bloquear derruba na hora todas as sessões abertas nele. */
  async definirBloqueio(sessao: SessaoAtual, aparelhoId: string, bloquear: boolean) {
    if (bloquear && aparelhoId === sessao.ap) {
      throw new ErroAcesso(HttpStatus.CONFLICT, 'proprio_aparelho', 'Você está usando este aparelho. Bloqueie a partir de outro.');
    }
    const [aparelho] = await this.db.query<{ id: string }>(
      `UPDATE aparelhos SET ativo = $3,
              bloqueado_por = CASE WHEN $3 THEN NULL ELSE $4 END,
              bloqueado_em = CASE WHEN $3 THEN NULL ELSE now() END
       WHERE id = $1 AND loja_id = $2 RETURNING id`,
      [aparelhoId, sessao.loja, !bloquear, sessao.sub],
    );
    if (!aparelho) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'aparelho_inexistente', 'Aparelho não encontrado nesta loja.');
    await this.auditoria.registrar({
      autor: sessao.sub,
      acao: bloquear ? 'aparelho.bloqueado' : 'aparelho.desbloqueado',
      lojaId: sessao.loja,
      aparelhoId: sessao.ap,
      detalhes: { aparelho: aparelhoId },
    });
    return { id: aparelhoId, ativo: !bloquear };
  }
}
