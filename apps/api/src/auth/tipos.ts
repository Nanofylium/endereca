export type Papel = 'repositor' | 'lider' | 'admin';

export interface Colaborador {
  matricula: string;
  nome: string;
  loja_id: string;
  papel: Papel;
  ativo_no_rh: boolean;
  palavra_hash: string | null;
  ativado_em: Date | null;
  versao_token: number;
}

export interface Aparelho {
  id: string;
  loja_id: string;
  descricao: string;
  ativo: boolean;
}

/** Conteúdo do token de sessão. */
export interface Sessao {
  sub: string;
  loja: string;
  papel: Papel;
  tv: number;
  ap: string;
}

export const MATRICULA_REGEX = /^[A-Za-z0-9]{3,20}$/;
