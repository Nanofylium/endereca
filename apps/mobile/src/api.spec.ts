import { criarApi, ErroApi } from './api';

function respostaFalsa(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

describe('cliente da API', () => {
  it('envia o aparelho, o token e o corpo', async () => {
    const chamadas: [string, RequestInit][] = [];
    const api = criarApi({
      baseUrl: 'http://api',
      aparelhoId: 'AP-1',
      token: () => 'tok',
      fetch: (async (url: string, init: RequestInit) => {
        chamadas.push([url, init]);
        return respostaFalsa(200, { token: 'novo' });
      }) as typeof fetch,
    });

    await api.entrar(' 004512 ', 'chiclete');
    const [url, init] = chamadas[0];
    expect(url).toBe('http://api/acesso/entrar');
    expect(init.headers).toMatchObject({ 'x-aparelho-id': 'AP-1', authorization: 'Bearer tok', 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ matricula: '004512', palavraSecreta: 'chiclete' });
  });

  it('codifica o QR Code na URL da ficha', async () => {
    let url = '';
    const api = criarApi({ baseUrl: 'http://api', aparelhoId: 'AP-1', fetch: (async (u: string) => ((url = u), respostaFalsa(200, {}))) as typeof fetch });
    await api.ficha('ENDERECA:P:100245');
    expect(url).toBe('http://api/produtos/ficha/ENDERECA%3AP%3A100245');
  });

  it('traz a mensagem e o motivo das recusas da API', async () => {
    const api = criarApi({
      baseUrl: 'http://api',
      aparelhoId: 'AP-1',
      fetch: (async () => respostaFalsa(401, { motivo: 'matricula_inexistente', mensagem: 'Matrícula não encontrada no cadastro do RH.' })) as typeof fetch,
    });
    await expect(api.entrar('999999', 'x')).rejects.toMatchObject({ status: 401, motivo: 'matricula_inexistente', message: 'Matrícula não encontrada no cadastro do RH.' });
  });

  it('entende erros de validação do Nest', async () => {
    const api = criarApi({ baseUrl: 'http://api', aparelhoId: 'AP-1', fetch: (async () => respostaFalsa(400, { message: ['Matrícula inválida.'] })) as typeof fetch });
    await expect(api.entrar('?', 'x')).rejects.toMatchObject({ message: 'Matrícula inválida.' });
  });

  it('avisa quando não há conexão', async () => {
    const api = criarApi({ baseUrl: 'http://api', aparelhoId: 'AP-1', fetch: (async () => { throw new TypeError('Network request failed'); }) as typeof fetch });
    await expect(api.buscar('arroz')).rejects.toMatchObject({ motivo: 'sem_conexao' });
  });

  it('sabe quando a sessão caiu', () => {
    expect(new ErroApi(401, 'sessao_revogada', '').exigeNovoLogin).toBe(true);
    expect(new ErroApi(401, 'palavra_errada', '').exigeNovoLogin).toBe(false);
  });
});
