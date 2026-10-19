import { Papel, SessaoAtual } from './tipos';

export interface Alvo {
  matricula: string;
  papel: Papel;
  loja_id: string;
  setor: string | null;
}

export function mesmoSetor(a: string | null, b: string | null): boolean {
  return !!a && !!b && a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

/**
 * Quem pode liberar o acesso de quem:
 * - líder: repositores do próprio setor;
 * - gerente operacional: repositores e líderes de todos os setores da loja;
 * - administrador: qualquer pessoa da loja, inclusive gerentes.
 * Ninguém libera o próprio acesso.
 */
export function podeGerir(sessao: SessaoAtual, alvo: Alvo): boolean {
  if (alvo.matricula === sessao.sub || alvo.loja_id !== sessao.loja) return false;
  switch (sessao.papel) {
    case 'lider':
      return alvo.papel === 'repositor' && mesmoSetor(alvo.setor, sessao.setor);
    case 'gerente':
      return alvo.papel === 'repositor' || alvo.papel === 'lider';
    case 'admin':
      return true;
    default:
      return false;
  }
}

/** Condição SQL que limita a equipe visível: o líder vê o próprio setor; gerente e administrador, a loja toda. */
export function filtroEquipe(sessao: SessaoAtual, alias: string, primeiroParametro: number): { sql: string; params: unknown[] } {
  if (sessao.papel === 'lider') {
    return {
      sql: `${alias}.loja_id = $${primeiroParametro} AND lower(trim(${alias}.setor)) = lower(trim($${primeiroParametro + 1}))`,
      params: [sessao.loja, sessao.setor ?? ''],
    };
  }
  return { sql: `${alias}.loja_id = $${primeiroParametro}`, params: [sessao.loja] };
}
