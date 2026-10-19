import { describe, expect, it } from 'vitest';
import { criarApi, ErroApi } from './api';

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;

describe('cliente da API do painel', () => {
  it('envia token e aparelho e monta a rota de bloqueio', async () => {
    const chamadas: [string, RequestInit][] = [];
    const api = criarApi({
      baseUrl: 'http://api',
      aparelhoId: 'WEB-1',
      token: () => 'tok',
      fetch: (async (url: string, init: RequestInit) => (chamadas.push([url, init]), resposta(200, {}))) as typeof fetch,
    });
    await api.bloquearAparelho('AND-12/3', true);
    expect(chamadas[0][0]).toBe('http://api/gerente/aparelhos/AND-12%2F3/bloquear');
    expect(chamadas[0][1].headers).toMatchObject({ authorization: 'Bearer tok', 'x-aparelho-id': 'WEB-1' });
  });

  it('repassa a mensagem de permissão da API', async () => {
    const api = criarApi({
      baseUrl: 'http://api',
      aparelhoId: 'WEB-1',
      fetch: (async () => resposta(403, { motivo: 'sem_permissao', mensagem: 'Você só libera repositores do seu setor.' })) as typeof fetch,
    });
    const erro = await api.gerarCodigo('008001').catch((e) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 403, motivo: 'sem_permissao', message: 'Você só libera repositores do seu setor.' });
    expect(erro.exigeNovoLogin).toBe(false);
  });
});
