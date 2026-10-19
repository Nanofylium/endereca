import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const PASTA = join(__dirname, 'migrations');

export async function aplicarMigracoes(pool: Pool): Promise<string[]> {
  await pool.query('CREATE TABLE IF NOT EXISTS migracoes (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())');
  const feitas = new Set((await pool.query<{ nome: string }>('SELECT nome FROM migracoes')).rows.map((r) => r.nome));
  const aplicadas: string[] = [];
  for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort()) {
    if (feitas.has(arquivo)) continue;
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(readFileSync(join(PASTA, arquivo), 'utf8'));
      await cliente.query('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
      await cliente.query('COMMIT');
      aplicadas.push(arquivo);
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  }
  return aplicadas;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  aplicarMigracoes(pool)
    .then((aplicadas) => console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(', ')}` : 'Banco já está atualizado'))
    .finally(() => pool.end());
}
