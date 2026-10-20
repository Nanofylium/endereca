import { describe, expect, it } from 'vitest';
import { expandirFaixa, montarLocais } from './etiquetas';

describe('etiquetas de endereço', () => {
  it('expande faixas mantendo zeros à esquerda', () => {
    expect(expandirFaixa('01-03')).toEqual(['01', '02', '03']);
    expect(expandirFaixa('1, 3, 5-6')).toEqual(['1', '3', '5', '6']);
    expect(expandirFaixa('A')).toEqual(['A']);
    expect(() => expandirFaixa('5-1')).toThrow('Faixa inválida');
  });

  it('combina módulos e níveis', () => {
    const locais = montarLocais('venda', ' R-07 ', '5-6', '1-2', '');
    expect(locais).toHaveLength(4);
    expect(locais[0]).toEqual({ tipo: 'venda', rua: 'R-07', modulo: '5', nivel: '1', posicao: undefined });
  });
});
