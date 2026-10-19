/**
 * Autoriza um celular da loja. O identificador aparece no rodapé da tela de login do app.
 * Uso: npm run cadastrar-aparelho -- <identificador> <loja> "<descrição>"
 */
import { Pool } from 'pg';

async function principal() {
  const [id, lojaId, descricao] = process.argv.slice(2);
  if (!id || !lojaId || !descricao) throw new Error('Uso: npm run cadastrar-aparelho -- <identificador> <loja> "<descrição>"');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      'INSERT INTO aparelhos (id, loja_id, descricao) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET loja_id = EXCLUDED.loja_id, descricao = EXCLUDED.descricao, ativo = TRUE',
      [id, lojaId, descricao],
    );
    await pool.query("INSERT INTO auditoria (autor, acao, loja_id, aparelho_id) VALUES ('sistema', 'aparelho.autorizado', $1, $2)", [lojaId, id]);
    console.log(`Aparelho ${id} autorizado na loja ${lojaId}.`);
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
