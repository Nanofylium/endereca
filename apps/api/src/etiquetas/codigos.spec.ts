import { descreverLocal, interpretarEtiqueta, novoCodigo } from './codigos';

describe('códigos das etiquetas', () => {
  it('gera códigos sem letras confundíveis', () => {
    for (let i = 0; i < 50; i++) expect(novoCodigo()).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
  });

  it('reconhece endereço, volume e produto', () => {
    expect(interpretarEtiqueta('ENDERECA:L:ab23cd45ef')).toEqual({ tipo: 'endereco', codigo: 'AB23CD45EF' });
    expect(interpretarEtiqueta(' ENDERECA:V:XY23CD45EF ')).toEqual({ tipo: 'volume', codigo: 'XY23CD45EF' });
    expect(interpretarEtiqueta('7890000000011')).toEqual({ tipo: 'produto', codigo: '7890000000011' });
    expect(interpretarEtiqueta('ENDERECA:P:100245')).toEqual({ tipo: 'produto', codigo: 'ENDERECA:P:100245' });
  });

  it('descreve o endereço', () => {
    expect(descreverLocal({ rua: 'R-07', modulo: '5', nivel: null, posicao: null })).toBe('R-07 · Módulo 5');
  });
});
