export const FUSO_LOJA = 'America/Sao_Paulo';
export const DIAS_PARA_ALERTA_PARADO = 3;

export type Alerta = 'parado' | 'repor_agora' | 'ok' | 'sem_dados';

export interface Indicadores {
  vendas7Dias: { dia: string; unidades: number }[];
  totalVendas7Dias: number;
  diasSemVenda: number | null;
  previsao: { alerta: Alerta; diasAteEsvaziar: number | null; mensagem: string };
}

/** Data de hoje (AAAA-MM-DD) no fuso da loja. */
export function hojeNaLoja(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_LOJA }).format(agora);
}

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export function calcularIndicadores(
  vendas: { dia: string; unidades: number }[],
  ultimaVenda: string | null,
  quantidadeGondola: number | null,
  hoje: string,
): Indicadores {
  const porDia = new Map(vendas.map((v) => [v.dia, v.unidades]));
  const vendas7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(hoje, i - 6);
    return { dia, unidades: porDia.get(dia) ?? 0 };
  });
  const totalVendas7Dias = vendas7Dias.reduce((soma, v) => soma + v.unidades, 0);
  const diasSemVenda = ultimaVenda ? Math.max(0, diasEntre(ultimaVenda, hoje)) : null;

  const media = totalVendas7Dias / 7;
  const diasAteEsvaziar = quantidadeGondola !== null && media > 0 ? Math.round((quantidadeGondola / media) * 10) / 10 : null;

  let previsao: Indicadores['previsao'];
  if (diasSemVenda !== null && diasSemVenda >= DIAS_PARA_ALERTA_PARADO) {
    previsao = { alerta: 'parado', diasAteEsvaziar, mensagem: `Sem venda há ${diasSemVenda} dias. Confira se está exposto, com preço e etiqueta.` };
  } else if (diasAteEsvaziar !== null && diasAteEsvaziar < 1) {
    previsao = { alerta: 'repor_agora', diasAteEsvaziar, mensagem: 'A gôndola deve esvaziar hoje. Reponha agora do estoque.' };
  } else if (diasAteEsvaziar !== null) {
    previsao = { alerta: 'ok', diasAteEsvaziar, mensagem: `Gôndola abastecida por cerca de ${Math.round(diasAteEsvaziar)} dia(s).` };
  } else {
    previsao = { alerta: 'sem_dados', diasAteEsvaziar: null, mensagem: 'Ainda não há vendas suficientes para prever a reposição.' };
  }

  return { vendas7Dias, totalVendas7Dias, diasSemVenda, previsao };
}

/** QR Code das etiquetas do Endereça: ENDERECA:P:<sku>. Qualquer outro valor é tratado como EAN ou SKU. */
export function interpretarCodigoLido(codigo: string): { sku?: string; eanOuSku?: string } {
  const valor = codigo.trim();
  const qr = /^ENDERECA:P:([A-Za-z0-9-]{1,40})$/i.exec(valor);
  return qr ? { sku: qr[1] } : { eanOuSku: valor };
}
