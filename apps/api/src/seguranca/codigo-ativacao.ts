import { createHmac, randomInt, timingSafeEqual } from 'crypto';

// Sem 0/O, 1/I/L, para o código ser lido em voz alta e digitado sem erro.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_CODIGO = 6;
export const VALIDADE_CODIGO_MS = 24 * 60 * 60 * 1000;

export function gerarCodigoAtivacao(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_CODIGO; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo;
}

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/[\s-]/g, '').toUpperCase();
}

/** O código fica guardado só como HMAC, preso à matrícula: vazado do banco, não serve para outra pessoa. */
export function hashCodigo(codigo: string, matricula: string, segredo: string): string {
  return createHmac('sha256', segredo).update(`${matricula}:${normalizarCodigo(codigo)}`).digest('base64');
}

export function conferirCodigo(codigo: string, matricula: string, segredo: string, armazenado: string): boolean {
  const esperado = Buffer.from(armazenado, 'base64');
  const obtido = Buffer.from(hashCodigo(codigo, matricula, segredo), 'base64');
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}
