import { dataCurta, diaDaSemana, formatarEndereco, notaComVirgula, textoDiasSemVenda } from './formatar';

describe('formatação', () => {
  it('monta o endereço só com as partes existentes', () => {
    const base = { tipo: 'venda' as const, quantidade: null, confirmadoEm: null, confirmadoPor: null };
    expect(formatarEndereco({ ...base, rua: 'R-07', modulo: '5', nivel: '3', posicao: null })).toBe('R-07 · Módulo 5 · Nível 3');
    expect(formatarEndereco({ ...base, rua: 'Bloco C', modulo: null, nivel: null, posicao: null })).toBe('Bloco C');
  });

  it('descreve os dias sem venda', () => {
    expect(textoDiasSemVenda(0)).toBe('Vendeu hoje');
    expect(textoDiasSemVenda(1)).toBe('Última venda ontem');
    expect(textoDiasSemVenda(5)).toBe('Há 5 dias sem venda');
    expect(textoDiasSemVenda(null)).toBe('Sem vendas registradas');
  });

  it('formata datas e notas no padrão brasileiro', () => {
    expect(notaComVirgula(4.6)).toBe('4,6');
    expect(dataCurta('2027-12-31')).toBe('31/12/2027');
    expect(diaDaSemana('2026-10-19')).toBe('seg');
  });
});
