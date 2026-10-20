import { randomBytes } from 'crypto';

// Sem 0/O e 1/I/L, para quem precisar digitar o código impresso embaixo do QR.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function novoCodigo(tamanho = 10): string {
  const bytes = randomBytes(tamanho);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export type CodigoLido =
  | { tipo: 'endereco'; codigo: string }
  | { tipo: 'volume'; codigo: string }
  | { tipo: 'produto'; codigo: string };

/** Etiqueta de endereço: ENDERECA:L:<código>. Etiqueta de volume: ENDERECA:V:<código>. O resto é produto. */
export function interpretarEtiqueta(lido: string): CodigoLido {
  const valor = lido.trim();
  const qr = /^ENDERECA:([LV]):([A-Za-z0-9]{6,20})$/i.exec(valor);
  if (!qr) return { tipo: 'produto', codigo: valor };
  return { tipo: qr[1].toUpperCase() === 'L' ? 'endereco' : 'volume', codigo: qr[2].toUpperCase() };
}

export const conteudoQrLocal = (codigo: string) => `ENDERECA:L:${codigo}`;
export const conteudoQrVolume = (codigo: string) => `ENDERECA:V:${codigo}`;

export const NOME_TIPO: Record<string, string> = {
  venda: 'Área de venda',
  deposito: 'Depósito',
  caixaria: 'Caixaria',
  gaveta: 'Gaveta',
  intermedio: 'Intermédio',
  aereo: 'Aéreo',
};

export function descreverLocal(l: { rua: string; modulo: string | null; nivel: string | null; posicao: string | null }): string {
  return [l.rua, l.modulo && `Módulo ${l.modulo}`, l.nivel && `Nível ${l.nivel}`, l.posicao && `Posição ${l.posicao}`].filter(Boolean).join(' · ');
}
