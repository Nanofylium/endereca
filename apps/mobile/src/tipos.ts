// Formatos devolvidos pela API (apps/api).

export interface Colaborador {
  matricula: string;
  nome: string;
  papel: 'repositor' | 'lider' | 'admin';
  lojaId: string;
}

export interface RespostaAcesso {
  token: string;
  colaborador: Colaborador;
}

export type TipoEndereco = 'venda' | 'deposito' | 'caixaria' | 'gaveta' | 'intermedio' | 'aereo';

export interface Endereco {
  tipo: TipoEndereco;
  rua: string;
  modulo: string | null;
  nivel: string | null;
  posicao: string | null;
  quantidade: number | null;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
}

export type Alerta = 'parado' | 'repor_agora' | 'ok' | 'sem_dados';

export interface Ficha {
  produto: { sku: string; ean: string | null; nome: string; marca: string | null; departamento: string };
  areaDeVenda: Endereco[];
  quantidadeGondola: number | null;
  estoque: Endereco[];
  apreciacao: { nota: number; calculadoEm: string } | null;
  vendas7Dias: { dia: string; unidades: number }[];
  totalVendas7Dias: number;
  diasSemVenda: number | null;
  previsao: { alerta: Alerta; diasAteEsvaziar: number | null; mensagem: string };
  lote: { lote: string; validade: string | null; fornecedor: string | null; proximaEntrega: string | null } | null;
  /** Caixas guardadas no estoque, na ordem em que devem sair (validade mais próxima primeiro). */
  caixas: Caixa[];
}

export interface Caixa {
  codigo: string;
  quantidade: number;
  lote: string | null;
  validade: string | null;
  recebidoEm: string;
  nomeTipo: string;
  descricao: string;
}

export interface ItemBusca {
  sku: string;
  ean: string | null;
  nome: string;
  departamento: string;
}

export interface EtiquetaLocal {
  codigo: string;
  qr: string;
  tipo: TipoEndereco;
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
  baixadoEm: string | null;
}

export type LeituraEtiqueta =
  | { tipo: 'endereco'; endereco: EtiquetaLocal; produtos: { sku: string; nome: string; quantidade: number | null; confirmadoEm: string | null }[] }
  | { tipo: 'volume'; volume: EtiquetaVolume }
  | { tipo: 'produto'; sku: string };

export interface LocalComQuantidade {
  nomeTipo: string;
  descricao: string;
  quantidade: number | null;
}

export interface Tarefa {
  id: string;
  tipo: 'boa_do_dia';
  sku: string;
  produto: string;
  setor: string;
  dia: string;
  instrucoes: string | null;
  responsavel: { matricula: string; nome: string } | null;
  situacao: 'aguardando_lider' | 'atribuida' | 'concluida' | 'sem_produto';
  enderecoVenda: LocalComQuantidade | null;
  estoque: LocalComQuantidade[];
}

export interface ResultadoFalta {
  id: string;
  sku: string;
  produto: string;
  estoque: LocalComQuantidade[];
  mensagem: string;
}
