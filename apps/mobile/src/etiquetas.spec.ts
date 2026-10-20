import { tipoDoCodigo } from './etiquetas';

describe('tipo do código lido', () => {
  it('separa endereço, volume e produto', () => {
    expect(tipoDoCodigo('ENDERECA:L:AB23CD45EF')).toBe('endereco');
    expect(tipoDoCodigo(' enderecA:v:ab23cd45ef ')).toBe('volume');
    expect(tipoDoCodigo('ENDERECA:P:100245')).toBe('produto');
    expect(tipoDoCodigo('7890000000011')).toBe('produto');
  });
});
