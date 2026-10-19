import { PoolClient } from 'pg';
import { gerarCodigoAtivacao, hashCodigo, VALIDADE_CODIGO_MS } from '../seguranca/codigo-ativacao';

/** Invalida os códigos pendentes da matrícula e grava um novo. Devolve o código em claro, só desta vez. */
export async function emitirCodigo(
  cliente: Pick<PoolClient, 'query'>,
  matricula: string,
  geradoPor: string,
  segredo: string,
): Promise<{ codigo: string; expiraEm: Date }> {
  const codigo = gerarCodigoAtivacao();
  const expiraEm = new Date(Date.now() + VALIDADE_CODIGO_MS);
  await cliente.query('UPDATE codigos_ativacao SET expira_em = now() WHERE matricula = $1 AND usado_em IS NULL AND expira_em > now()', [matricula]);
  await cliente.query('INSERT INTO codigos_ativacao (matricula, codigo_hash, gerado_por, expira_em) VALUES ($1, $2, $3, $4)', [
    matricula,
    hashCodigo(codigo, matricula, segredo),
    geradoPor,
    expiraEm,
  ]);
  return { codigo, expiraEm };
}
