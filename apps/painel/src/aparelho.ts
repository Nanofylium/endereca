const CHAVE_APARELHO = 'endereca.aparelho';
const CHAVE_SESSAO = 'endereca.sessao';

/**
 * Identificador deste navegador. A TI o cadastra como aparelho autorizado da loja,
 * do mesmo jeito que os celulares; ele aparece na tela de login.
 */
export function identificarNavegador(): string {
  try {
    const salvo = localStorage.getItem(CHAVE_APARELHO);
    if (salvo) return salvo;
    const novo = `WEB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    localStorage.setItem(CHAVE_APARELHO, novo);
    return novo;
  } catch {
    return 'WEB-SEM-ARMAZENAMENTO';
  }
}

// A sessão fica só nesta aba: fechar o navegador encerra o acesso.
export function lerSessao<T>(): T | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(valor: unknown | null): void {
  try {
    if (valor === null) sessionStorage.removeItem(CHAVE_SESSAO);
    else sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(valor));
  } catch {
    // Sem armazenamento, a sessão vale só enquanto a página estiver aberta.
  }
}
