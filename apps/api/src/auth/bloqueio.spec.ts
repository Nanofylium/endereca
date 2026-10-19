import { bloqueadoAte, JANELA_BLOQUEIO_MS } from './bloqueio';

const agora = new Date('2026-10-19T12:00:00Z');
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000);
const falha = (m: number) => ({ sucesso: false, criado_em: minutosAtras(m) });
const sucesso = (m: number) => ({ sucesso: true, criado_em: minutosAtras(m) });

describe('bloqueio por tentativas', () => {
  it('libera com menos falhas que o limite', () => {
    expect(bloqueadoAte([falha(1), falha(2)], 3, agora)).toBeNull();
  });

  it('bloqueia por 15 minutos a partir da falha que atingiu o limite', () => {
    const ate = bloqueadoAte([falha(1), falha(2), falha(3)], 3, agora);
    expect(ate?.getTime()).toBe(minutosAtras(1).getTime() + JANELA_BLOQUEIO_MS);
  });

  it('um acesso com sucesso zera a contagem', () => {
    expect(bloqueadoAte([falha(1), sucesso(2), falha(3), falha(4)], 3, agora)).toBeNull();
  });

  it('falhas fora da janela não contam', () => {
    expect(bloqueadoAte([falha(1), falha(2), falha(20)], 3, agora)).toBeNull();
  });
});
