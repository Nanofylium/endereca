// Formatos devolvidos pela API (apps/api).

export type Papel = 'repositor' | 'lider' | 'gerente' | 'admin';
export type Situacao = 'ativo' | 'pendente' | 'bloqueado';

export interface RespostaAcesso {
  token: string;
  colaborador: { matricula: string; nome: string; papel: Papel; lojaId: string };
}

export interface MembroEquipe {
  matricula: string;
  nome: string;
  papel: Papel;
  setor: string | null;
  situacao: Situacao;
  ultimoAcesso: string | null;
  codigoValidoAte: string | null;
  podeLiberar: boolean;
}

export interface CodigoGerado {
  matricula: string;
  nome: string;
  codigo: string;
  expiraEm: string;
}

export interface TentativaRecusada {
  matricula: string;
  aparelho_id: string | null;
  tipo: 'ativacao' | 'login';
  motivo: string;
  criado_em: string;
}

export interface Aviso {
  id: string;
  tipo: string;
  texto: string;
  criado_em: string;
}

export interface ProdutoEmAlerta {
  sku: string;
  nome: string;
  departamento: string;
  enderecoVenda: string | null;
  diasSemVenda: number | null;
  previsao: { alerta: 'parado' | 'repor_agora' | 'ok' | 'sem_dados'; diasAteEsvaziar: number | null; mensagem: string };
}

export interface ResumoSetor {
  setor: string;
  lideres: string[];
  total: number;
  ativos: number;
  pendentes: number;
  bloqueados: number;
  produtosEmAlerta: number;
}

export interface Aparelho {
  id: string;
  descricao: string;
  ativo: boolean;
  bloqueado_por: string | null;
  bloqueado_em: string | null;
  ultimo_uso: string | null;
}
