import {
  Aparelho,
  Aviso,
  CodigoGerado,
  EtiquetaLocal,
  EtiquetaVolume,
  Falta,
  MembroEquipe,
  NovaBoaDoDia,
  NovoLocal,
  NovoRecebimento,
  ProdutoEmAlerta,
  ProgressoTreino,
  RespostaAcesso,
  ResumoSetor,
  Tarefa,
  TentativaRecusada,
} from './tipos';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly motivo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }

  /** A sessão não vale mais: o painel volta para o login. */
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
  const executar = opcoes.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

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
      throw new ErroApi(0, 'sem_conexao', 'Sem conexão com o servidor. Verifique a rede da loja e tente de novo.');
    }

    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
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
    equipe: () => chamar<MembroEquipe[]>('GET', '/lider/equipe'),
    gerarCodigo: (matricula: string) => chamar<CodigoGerado>('POST', '/lider/codigos-ativacao', { matricula }),
    tentativasRecusadas: () => chamar<TentativaRecusada[]>('GET', '/lider/tentativas-recusadas'),
    avisos: () => chamar<Aviso[]>('GET', '/lider/avisos'),
    produtosEmAlerta: () => chamar<ProdutoEmAlerta[]>('GET', '/lider/produtos-em-alerta'),
    setores: () => chamar<ResumoSetor[]>('GET', '/gerente/setores'),
    aparelhos: () => chamar<Aparelho[]>('GET', '/gerente/aparelhos'),
    bloquearAparelho: (id: string, bloquear: boolean) =>
      chamar<{ id: string; ativo: boolean }>('POST', `/gerente/aparelhos/${encodeURIComponent(id)}/${bloquear ? 'bloquear' : 'desbloquear'}`),
    enderecos: () => chamar<EtiquetaLocal[]>('GET', '/etiquetas/enderecos'),
    criarEnderecos: (locais: NovoLocal[]) => chamar<EtiquetaLocal[]>('POST', '/etiquetas/enderecos', { locais }),
    receberVolumes: (dados: NovoRecebimento) => chamar<EtiquetaVolume[]>('POST', '/etiquetas/volumes', dados),
    tarefas: (dia?: string) => chamar<Tarefa[]>('GET', `/tarefas${dia ? `?dia=${dia}` : ''}`),
    enviarBoaDoDia: (dados: NovaBoaDoDia) => chamar<Tarefa>('POST', '/tarefas/boa-do-dia', dados),
    atribuirTarefa: (id: string, matricula: string) => chamar<Tarefa>('POST', `/tarefas/${encodeURIComponent(id)}/atribuir`, { matricula }),
    faltas: () => chamar<Falta[]>('GET', '/faltas'),
    treinoEquipe: () => chamar<ProgressoTreino[]>('GET', '/treino/equipe'),
    resolverFalta: (id: string) => chamar<{ id: string; resolvida: boolean }>('POST', `/faltas/${encodeURIComponent(id)}/resolver`),
    volumesAguardando: () => chamar<EtiquetaVolume[]>('GET', '/etiquetas/volumes/aguardando'),
  };
}

export type Api = ReturnType<typeof criarApi>;
