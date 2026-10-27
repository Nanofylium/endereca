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

export type TipoLocal = 'venda' | 'deposito' | 'caixaria' | 'gaveta' | 'intermedio' | 'aereo';

export interface NovoLocal {
  tipo: TipoLocal;
  rua: string;
  modulo?: string;
  nivel?: string;
  posicao?: string;
}

export interface EtiquetaLocal {
  codigo: string;
  qr: string;
  tipo: TipoLocal;
  nomeTipo: string;
  descricao: string;
}

export interface EtiquetaVolume {
  codigo: string;
  qr: string;
  sku: string;
  produto: string;
  quantidade: number;
  lote: string | null;
  validade: string | null;
  recebidoEm: string;
  guardado: { local: EtiquetaLocal; em: string; por: string | null } | null;
}

export interface NovoRecebimento {
  produto: string;
  quantidade: number;
  volumes: number;
  lote?: string;
  validade?: string;
}

export interface LocalComQuantidade {
  nomeTipo: string;
  descricao: string;
  quantidade: number | null;
}

export type SituacaoTarefa = 'aguardando_lider' | 'atribuida' | 'concluida' | 'sem_produto';

export interface Tarefa {
  id: string;
  tipo: 'boa_do_dia';
  sku: string;
  produto: string;
  setor: string;
  dia: string;
  instrucoes: string | null;
  criadaPor: string;
  criadaEm: string;
  responsavel: { matricula: string; nome: string } | null;
  atribuidaEm: string | null;
  situacao: SituacaoTarefa;
  concluidaEm: string | null;
  observacao: string | null;
  enderecoVenda: LocalComQuantidade | null;
  estoque: LocalComQuantidade[];
}

export interface NovaBoaDoDia {
  produto: string;
  setor?: string;
  dia?: string;
  instrucoes?: string;
}

export interface Falta {
  id: string;
  sku: string;
  produto: string;
  departamento: string;
  reportadoPor: string;
  reportadoPorNome: string | null;
  reportadoEm: string;
  estoque: number;
  observacao: string | null;
}

/** Progresso de um repositor no treinamento. */
export interface ProgressoTreino {
  matricula: string;
  nome: string;
  setor: string | null;
  pontos: number;
  nivel: string;
  licoesConcluidas: number;
  licoesTotal: number;
  ultimaAtividade: string | null;
}
