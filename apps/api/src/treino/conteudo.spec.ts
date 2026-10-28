import { NIVEIS, nivelPorPontos, PONTOS_POR_ACERTO, TRILHA } from './conteudo';

describe('conteúdo do treino', () => {
  it('cada pergunta tem a resposta certa entre as opções e as lições têm ids únicos', () => {
    expect(new Set(TRILHA.map((l) => l.id)).size).toBe(TRILHA.length);
    for (const l of TRILHA) {
      expect(l.perguntas.length).toBeGreaterThan(0);
      for (const p of l.perguntas) expect(p.opcoes[p.correta]).toBeDefined();
    }
  });

  it('dá para virar Repositor só com as lições, e os níveis seguintes pedem prática', () => {
    const maximoLicoes = TRILHA.reduce((s, l) => s + l.perguntas.length, 0) * PONTOS_POR_ACERTO;
    expect(maximoLicoes).toBeGreaterThanOrEqual(NIVEIS[1].apartir);
    expect(maximoLicoes).toBeLessThan(NIVEIS[2].apartir);
    expect(nivelPorPontos(0)).toMatchObject({ atual: { nome: 'Aprendiz' }, faltam: NIVEIS[1].apartir });
    expect(nivelPorPontos(10_000)).toMatchObject({ atual: { nome: 'Pronto para liderar' }, proximo: null, faltam: 0 });
  });
});
