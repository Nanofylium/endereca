/**
 * Primeiro acesso de uma loja nova: a TI gera, no servidor, o código do primeiro líder ou administrador.
 * A matrícula precisa já ter vindo do RH. Uso: npm run codigo-inicial -- <matricula>
 */
import { Pool } from 'pg';
import { emitirCodigo } from '../lider/emitir-codigo';

async function principal() {
  const matricula = process.argv[2];
  const segredo = process.env.JWT_SECRET;
  if (!matricula || !segredo) throw new Error('Informe a matrícula e defina JWT_SECRET e DATABASE_URL.');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const [colaborador] = (await pool.query('SELECT nome, papel, ativo_no_rh FROM colaboradores WHERE matricula = $1', [matricula])).rows;
    if (!colaborador?.ativo_no_rh) throw new Error(`Matrícula ${matricula} não está ativa no cadastro do RH.`);
    const { codigo, expiraEm } = await emitirCodigo(pool, matricula, 'sistema', segredo);
    await pool.query("INSERT INTO auditoria (autor, acao, detalhes) VALUES ('sistema', 'codigo_ativacao.gerado', $1)", [JSON.stringify({ matricula })]);
    console.log(`${colaborador.nome} (${colaborador.papel}): código ${codigo}, válido até ${expiraEm.toLocaleString('pt-BR')}`);
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
