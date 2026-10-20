import { EtiquetaVolume, Ficha, ItemBusca, LeituraEtiqueta, RespostaAcesso, ResultadoFalta, Tarefa } from './tipos';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly motivo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }

  /** A sessão não vale mais: o app volta para o login. */
  get exigeNovoLogin(): boolean {
    return this.status === 401 && ['sem_sessao', 'sessao_expirada', 'sessao_revogada', 'aparelho_diferente'].includes(this.motivo);
  }
}

export interface OpcoesApi {
  baseUrl: string;
  aparelhoId: string;
  token?: () => string | null;
  fetch?: typeof fetch;
}

export function criarApi(opcoes: OpcoesApi) {
  const executar = opcoes.fetch ?? fetch;

  async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
    const cabecalhos: Record<string, string> = { 'x-aparelho-id': opcoes.aparelhoId };
    if (corpo !== undefined) cabecalhos['content-type'] = 'application/json';
    const token = opcoes.token?.();
    if (token) cabecalhos.authorization = `Bearer ${token}`;

    let resposta: Response;
    try {
      resposta = await executar(`${opcoes.baseUrl}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroApi(0, 'sem_conexao', 'Sem conexão com o servidor. Verifique o Wi-Fi da loja e tente de novo.');
    }

    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      // O ValidationPipe do Nest devolve "message" como lista; as regras da API devolvem "mensagem".
      const mensagem =
        dados?.mensagem ?? (Array.isArray(dados?.message) ? dados.message[0] : dados?.message) ?? 'Algo deu errado. Tente de novo.';
      throw new ErroApi(resposta.status, dados?.motivo ?? 'erro', mensagem);
    }
    return dados as T;
  }

  return {
    entrar: (matricula: string, palavraSecreta: string) =>
      chamar<RespostaAcesso>('POST', '/acesso/entrar', { matricula: matricula.trim(), palavraSecreta }),
    ativar: (matricula: string, codigo: string, palavraSecreta: string) =>
      chamar<RespostaAcesso>('POST', '/acesso/ativar', { matricula: matricula.trim(), codigo: codigo.trim(), palavraSecreta }),
    ficha: (codigoLido: string) => chamar<Ficha>('GET', `/produtos/ficha/${encodeURIComponent(codigoLido.trim())}`),
    buscar: (termo: string) => chamar<ItemBusca[]>('GET', `/produtos?q=${encodeURIComponent(termo)}`),
    minhasTarefas: () => chamar<Tarefa[]>('GET', '/tarefas/minhas'),
    concluirTarefa: (id: string, resultado: 'feito' | 'sem_produto', observacao?: string) =>
      chamar<{ tarefa: Tarefa; falta: ResultadoFalta | null }>('POST', `/tarefas/${encodeURIComponent(id)}/concluir`, { resultado, observacao }),
    registrarFalta: (produto: string) => chamar<ResultadoFalta>('POST', '/faltas', { produto }),
    lerEtiqueta: (codigoLido: string) => chamar<LeituraEtiqueta>('GET', `/etiquetas/ler/${encodeURIComponent(codigoLido.trim())}`),
    guardar: (volume: string, endereco: string) =>
      chamar<{ volume: EtiquetaVolume; movido: boolean }>('POST', '/etiquetas/guardar', { volume: volume.trim(), endereco: endereco.trim() }),
  };
}

export type Api = ReturnType<typeof criarApi>;
