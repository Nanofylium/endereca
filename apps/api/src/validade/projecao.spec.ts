import { projetarLotes } from './projecao';

const HOJE = '2026-10-28';

describe('projeção de vencimento', () => {
  it('a gôndola vende primeiro e os lotes saem pela validade', () => {
    const r = projetarLotes(
      [
        { lote: 'B', validade: '2026-11-17', quantidade: 40 },
        { lote: 'A', validade: '2026-11-07', quantidade: 30 },
      ],
      { hoje: HOJE, mediaDiaria: 5, naGondola: 20, temFornecedor: true },
    );
    // Lote A: 10 dias × 5 = 50 vendidas, 20 da gôndola, então 30 do lote A: nada sobra.
    expect(r[0]).toMatchObject({ lote: 'A', diasParaVencer: 10, vendeAte: 30, sobra: 0, sugestao: 'vende_a_tempo' });
    // Lote B: 20 dias × 5 = 100, menos 50 antes dele = 40: também vende.
    expect(r[1]).toMatchObject({ lote: 'B', sobra: 0 });
  });

  it('sugere rebaixar perto do vencimento, destacar no meio do caminho e retirar o vencido', () => {
    const base = { hoje: HOJE, mediaDiaria: 1, naGondola: 0, temFornecedor: false };
    expect(projetarLotes([{ lote: 'X', validade: '2026-11-02', quantidade: 20 }], base)[0]).toMatchObject({ sobra: 15, sugestao: 'rebaixar' });
    expect(projetarLotes([{ lote: 'X', validade: '2026-11-20', quantidade: 40 }], base)[0]).toMatchObject({ sobra: 17, sugestao: 'destacar' });
    expect(projetarLotes([{ lote: 'X', validade: '2026-10-28', quantidade: 6 }], base)[0]).toMatchObject({ sobra: 6, sugestao: 'retirar' });
  });

  it('produto parado com fornecedor: devolver enquanto há prazo', () => {
    const r = projetarLotes([{ lote: 'X', validade: '2026-11-25', quantidade: 12 }], { hoje: HOJE, mediaDiaria: 0, naGondola: 0, temFornecedor: true });
    expect(r[0]).toMatchObject({ sobra: 12, sugestao: 'devolver' });
  });
});
