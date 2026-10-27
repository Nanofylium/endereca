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
  produto: {
    sku: string;
    ean: string | null;
    nome: string;
    marca: string | null;
    departamento: string;
    codigoInterno: string | null;
    classe: string | null;
    setorSave: string | null;
    unidadesEmbalagem: number | null;
    /** Caixas por camada do palete. */
    lastro: number | null;
    /** Camadas por palete. */
    altura: number | null;
    vidaUtilDias: number | null;
  };
  leitura: Leitura;
  estoqueTotal: { unidades: number | null; gondola: number | null; estoque: number | null; embalagens: number | null };
  preco: { unidade: number | null; embalagem: number | null; atualizadoEm: string } | null;
  ultimaCompra: { data: string; quantidade: number | null } | null;
  ultimaVenda: string | null;
  palete: { lastro: number; altura: number; caixas: number; unidades: number | null } | null;
  idadeEstoque: { desde: string; dias: number } | null;
  conjuntos: { codigo: string; nome: string; quantidade: number }[];
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

export interface Leitura {
  forma: 'qr' | 'ean' | 'sku';
  em: string;
  leiturasHoje: number;
  anterior: { em: string; nome: string | null } | null;
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

export interface ProdutoNaGondola {
  sku: string;
  ean: string | null;
  nome: string;
  posicao: string | null;
  quantidade: number | null;
  unidadesEmbalagem: number | null;
  precoUnidade: number | null;
  precoAtacado: number | null;
  quantidadeAtacado: number | null;
  precoEmbalagem: number | null;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
  /** Ninguém conferiu este produto na prateleira há mais de 30 dias. */
  conferirDeNovo: boolean;
}

/** Planograma digital de um módulo da área de venda, no lugar das etiquetas de prateleira. */
export interface ModuloGondola {
  rua: string;
  modulo: string | null;
  niveis: { nivel: string | null; produtos: ProdutoNaGondola[] }[];
}

export interface Conferencia {
  resultado: 'confirmado' | 'movido' | 'novo';
  antes: string | null;
  substituido: { sku: string; nome: string } | null;
  produto: { sku: string; nome: string };
  endereco: string;
}

export interface NivelTreino {
  atual: { nome: string; apartir: number; descricao: string };
  proximo: { nome: string; apartir: number; descricao: string } | null;
  faltam: number;
}

export interface ResumoTreino {
  pontos: number;
  nivel: NivelTreino;
  licoes: { id: string; titulo: string; resumo: string; minutos: number; perguntas: number; acertos: number | null; concluida: boolean }[];
  desafiosHoje: { feitos: number; acertos: number };
  carreira: { cargo: string; foco: string }[];
}

export interface LicaoTreino {
  id: string;
  titulo: string;
  resumo: string;
  minutos: number;
  topicos: string[];
  perguntas: { pergunta: string; opcoes: string[] }[];
}

export interface ResultadoLicao {
  acertos: number;
  total: number;
  aprovado: boolean;
  correcoes: { acertou: boolean; correta: number; explicacao: string }[];
  pontos: number;
  ganhou: number;
  nivel: NivelTreino;
  subiuDeNivel: string | null;
}

export interface DesafioTreino {
  sku: string;
  nome: string;
  ean: string | null;
  opcoes: string[];
}

export interface ResultadoDesafio {
  acertou: boolean;
  correta: string;
  pontos: number;
  ganhou: number;
  nivel: NivelTreino;
  subiuDeNivel: string | null;
}
