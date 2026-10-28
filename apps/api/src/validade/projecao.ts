/** Ações que o líder pode tomar com um lote perto de vencer. */
export type AcaoVencimento = 'destacar' | 'rebaixar' | 'devolver' | 'retirar';
export type Sugestao = AcaoVencimento | 'vende_a_tempo';

export const ACOES_VENCIMENTO: AcaoVencimento[] = ['destacar', 'rebaixar', 'devolver', 'retirar'];
export const JANELA_PADRAO_DIAS = 45;
export const DIAS_PARA_REBAIXAR = 7;
export const DIAS_PARA_DESTACAR = 30;

export interface LoteEmEstoque {
  lote: string;
  validade: string;
  quantidade: number;
}

export interface LoteProjetado extends LoteEmEstoque {
  diasParaVencer: number;
  vendeAte: number;
  sobra: number;
  sugestao: Sugestao;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/**
 * Quanto de cada lote deve sobrar no dia em que vence. A gôndola vende primeiro e os lotes saem na ordem da
 * validade (o mais próximo de vencer primeiro), no ritmo médio de venda dos últimos dias.
 */
export function projetarLotes(
  lotes: LoteEmEstoque[],
  opcoes: { hoje: string; mediaDiaria: number; naGondola: number; temFornecedor: boolean },
): LoteProjetado[] {
  const ordenados = [...lotes].sort((a, b) => a.validade.localeCompare(b.validade) || a.lote.localeCompare(b.lote));
  let antes = Math.max(0, opcoes.naGondola);
  return ordenados.map((l) => {
    const diasParaVencer = diasEntre(opcoes.hoje, l.validade);
    const vendidasAteVencer = Math.max(0, diasParaVencer) * Math.max(0, opcoes.mediaDiaria);
    const vendeAte = Math.min(l.quantidade, Math.max(0, Math.floor(vendidasAteVencer - antes)));
    const sobra = diasParaVencer <= 0 ? l.quantidade : l.quantidade - vendeAte;
    antes += l.quantidade;
    return { ...l, diasParaVencer, vendeAte, sobra, sugestao: sugerir(diasParaVencer, sobra, l.quantidade, opcoes) };
  });
}

function sugerir(dias: number, sobra: number, quantidade: number, o: { mediaDiaria: number; temFornecedor: boolean }): Sugestao {
  if (dias <= 0) return 'retirar';
  if (sobra === 0) return 'vende_a_tempo';
  // Produto parado com quase tudo sobrando: melhor negociar a troca com o fornecedor enquanto ainda há prazo.
  if (o.mediaDiaria === 0 && o.temFornecedor && dias > DIAS_PARA_REBAIXAR && sobra === quantidade) return 'devolver';
  if (dias <= DIAS_PARA_REBAIXAR) return 'rebaixar';
  if (dias <= DIAS_PARA_DESTACAR) return 'destacar';
  return o.temFornecedor && sobra === quantidade ? 'devolver' : 'destacar';
}
