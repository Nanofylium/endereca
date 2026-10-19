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
}

export interface ItemBusca {
  sku: string;
  ean: string | null;
  nome: string;
  departamento: string;
}
