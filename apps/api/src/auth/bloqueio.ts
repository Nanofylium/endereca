export const JANELA_BLOQUEIO_MS = 15 * 60 * 1000;
export const LIMITE_FALHAS_MATRICULA = 3;
// Um aparelho é usado por vários repositores, então tolera um pouco mais antes de travar.
export const LIMITE_FALHAS_APARELHO = 5;

export interface Tentativa {
  sucesso: boolean;
  criado_em: Date;
}

/**
 * Conta as falhas seguidas dentro da janela, da mais recente para trás, parando no último sucesso.
 * Recebe as tentativas ordenadas da mais nova para a mais antiga.
 */
export function falhasRecentes(tentativas: Tentativa[], agora: Date): Tentativa[] {
  const limite = agora.getTime() - JANELA_BLOQUEIO_MS;
  const falhas: Tentativa[] = [];
  for (const t of tentativas) {
    if (t.sucesso || t.criado_em.getTime() < limite) break;
    falhas.push(t);
  }
  return falhas;
}

/** Retorna até quando o acesso fica bloqueado, ou null se está liberado. */
export function bloqueadoAte(tentativas: Tentativa[], limiteFalhas: number, agora: Date): Date | null {
  const falhas = falhasRecentes(tentativas, agora);
  if (falhas.length < limiteFalhas) return null;
  // Conta a partir da falha mais recente: insistir durante o bloqueio estende o bloqueio.
  const ate = new Date(falhas[0].criado_em.getTime() + JANELA_BLOQUEIO_MS);
  return ate > agora ? ate : null;
}
