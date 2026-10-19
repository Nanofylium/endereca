import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number, opcoes: object) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 32;

// Palavras que qualquer pessoa da loja tentaria primeiro.
const PROIBIDAS = new Set(['senha', 'senha123', 'atacadao', 'carrefour', 'endereca', 'repositor', 'abcdef', 'qwerty', 'mudar123']);

export const MINIMO_CARACTERES = 6;

/** A palavra secreta não diferencia maiúsculas, acentos compostos ou espaços nas pontas. */
export function normalizarPalavra(palavra: string): string {
  return palavra.normalize('NFC').trim().toLowerCase();
}

/** Devolve o motivo da recusa, ou null quando a palavra pode ser usada. */
export function validarPalavraSecreta(palavra: string, dono: { matricula: string; nome: string }): string | null {
  const p = normalizarPalavra(palavra);
  if (p.length < MINIMO_CARACTERES) return `A palavra secreta precisa ter pelo menos ${MINIMO_CARACTERES} caracteres.`;
  if (p.length > 64) return 'A palavra secreta pode ter no máximo 64 caracteres.';
  if (!/\p{L}/u.test(p)) return 'Use letras na palavra secreta, não apenas números.';
  if (PROIBIDAS.has(p)) return 'Essa palavra é fácil de adivinhar. Escolha outra.';
  if (p.includes(dono.matricula)) return 'A palavra secreta não pode conter a sua matrícula.';
  const partesNome = normalizarPalavra(dono.nome).split(/\s+/).filter((parte) => parte.length >= 3);
  if (partesNome.some((parte) => p.includes(parte))) return 'A palavra secreta não pode conter o seu nome.';
  return null;
}

export async function gerarHashPalavra(palavra: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(normalizarPalavra(palavra), sal, TAMANHO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

export async function conferirPalavra(palavra: string, armazenado: string): Promise<boolean> {
  const [algoritmo, n, r, p, salB64, hashB64] = armazenado.split('$');
  if (algoritmo !== 'scrypt' || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = await scrypt(normalizarPalavra(palavra), Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(esperado, obtido);
}
