import { calcularIndicadores, hojeNaLoja, interpretarCodigoLido } from './indicadores';

const hoje = '2026-10-19';

describe('indicadores do produto', () => {
  it('preenche os 7 dias, com zero onde não houve venda', () => {
    const r = calcularIndicadores([{ dia: '2026-10-19', unidades: 10 }, { dia: '2026-10-13', unidades: 4 }], '2026-10-19', 100, hoje);
    expect(r.vendas7Dias.map((v) => v.dia)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
    expect(r.vendas7Dias.map((v) => v.unidades)).toEqual([4, 0, 0, 0, 0, 0, 10]);
    expect(r.totalVendas7Dias).toBe(14);
    expect(r.diasSemVenda).toBe(0);
  });

  it('marca como parado a partir de 3 dias sem venda', () => {
    const r = calcularIndicadores([{ dia: '2026-10-14', unidades: 6 }], '2026-10-14', 20, hoje);
    expect(r.diasSemVenda).toBe(5);
    expect(r.previsao.alerta).toBe('parado');
  });

  it('pede reposição quando a gôndola não dura um dia', () => {
    const vendas = Array.from({ length: 7 }, (_, i) => ({ dia: `2026-10-1${3 + i}`, unidades: 100 }));
    const r = calcularIndicadores(vendas, hoje, 50, hoje);
    expect(r.previsao).toMatchObject({ alerta: 'repor_agora', diasAteEsvaziar: 0.5 });
  });

  it('estima os dias de gôndola abastecida', () => {
    const vendas = Array.from({ length: 7 }, (_, i) => ({ dia: `2026-10-1${3 + i}`, unidades: 10 }));
    expect(calcularIndicadores(vendas, hoje, 30, hoje).previsao).toMatchObject({ alerta: 'ok', diasAteEsvaziar: 3 });
  });

  it('não inventa previsão sem vendas', () => {
    const r = calcularIndicadores([], null, 30, hoje);
    expect(r.diasSemVenda).toBeNull();
    expect(r.previsao.alerta).toBe('sem_dados');
  });

  it('usa o dia no fuso da loja', () => {
    expect(hojeNaLoja(new Date('2026-10-20T02:00:00Z'))).toBe('2026-10-19');
  });
});

describe('leitura de código', () => {
  it('reconhece o QR Code do Endereça', () => {
    expect(interpretarCodigoLido('ENDERECA:P:100245')).toEqual({ sku: '100245' });
  });

  it('trata o resto como EAN ou SKU', () => {
    expect(interpretarCodigoLido(' 7890000000011 ')).toEqual({ eanOuSku: '7890000000011' });
  });
});
