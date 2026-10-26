import { Alerta, Endereco, Leitura, TipoEndereco } from './tipos';

export const NOME_TIPO: Record<TipoEndereco, string> = {
  venda: 'Área de venda',
  deposito: 'Depósito',
  caixaria: 'Caixaria',
  gaveta: 'Gaveta',
  intermedio: 'Intermédio',
  aereo: 'Aéreo',
};

/** "R-07 · Módulo 5 · Nível 3", sem as partes que o endereço não tem. */
export function formatarEndereco(e: Endereco): string {
  return [e.rua, e.modulo && `Módulo ${e.modulo}`, e.nivel && `Nível ${e.nivel}`, e.posicao && `Posição ${e.posicao}`]
    .filter(Boolean)
    .join(' · ');
}

export function textoDiasSemVenda(dias: number | null): string {
  if (dias === null) return 'Sem vendas registradas';
  if (dias === 0) return 'Vendeu hoje';
  if (dias === 1) return 'Última venda ontem';
  return `Há ${dias} dias sem venda`;
}

export function notaComVirgula(nota: number): string {
  return nota.toFixed(1).replace('.', ',');
}

/** "2026-10-19" → "seg" */
export function diaDaSemana(dia: string): string {
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${dia}T12:00:00Z`).getUTCDay()];
}

/** "2027-12-31" → "31/12/2027" */
export function dataCurta(dia: string | null): string {
  if (!dia) return '—';
  const [a, m, d] = dia.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export const ALERTA_GRAVE: Record<Alerta, boolean> = { parado: true, repor_agora: true, ok: false, sem_dados: false };

/** 159.9 → "R$ 159,90" */
export function reais(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const [inteiro, centavos] = valor.toFixed(2).split('.');
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const FORMA_LEITURA: Record<Leitura['forma'], string> = { qr: 'QR Code', ean: 'Código de barras', sku: 'Código digitado' };

/** "QR Code · 3ª leitura hoje" */
export function textoLeitura(l: Leitura): string {
  return `${FORMA_LEITURA[l.forma]} · ${l.leiturasHoje}ª leitura hoje`;
}

/** 0 → "chegou hoje", 1 → "1 dia", 12 → "12 dias" */
export function textoIdade(dias: number): string {
  if (dias === 0) return 'chegou hoje';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
