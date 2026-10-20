/**
 * Dados de demonstração, os mesmos do protótipo. Não use em produção: lá as matrículas vêm só do RH.
 * Uso: npm run seed
 */
import { Pool } from 'pg';
import { hojeNaLoja } from '../produtos/indicadores';
import { novoCodigo } from '../etiquetas/codigos';
import { aplicarMigracoes } from './migrate';

const LOJA = { id: 'L001', nome: 'Loja de demonstração' };

const COLABORADORES: [string, string, string, string | null][] = [
  ['000100', 'Rita Albuquerque', 'gerente', null],
  ['001000', 'Marcos Teixeira', 'lider', 'Mercearia'],
  ['002000', 'Sueli Prado', 'lider', 'Padaria'],
  ['004512', 'Carla Mendes', 'repositor', 'Mercearia'],
  ['003871', 'Bruno Lima', 'repositor', 'Bebidas'],
  ['005093', 'Ana Souza', 'repositor', 'Limpeza'],
  ['007001', 'Ivo Ramos', 'repositor', 'Mercearia'],
  ['008001', 'Davi Nogueira', 'repositor', 'Padaria'],
];

const PRODUTOS = [
  { sku: '100245', ean: '7890000000011', nome: 'Arroz tipo 1 5 kg', departamento: 'Mercearia', venda: ['R-07', '5', '3', 160], estoque: ['deposito', 'Rua B', '04', '2', 18], nota: 4.6, vendas: [62, 58, 71, 66, 90, 112, 48] },
  { sku: '200917', ean: '7890000000035', nome: 'Refrigerante cola 2 L', departamento: 'Bebidas', venda: ['R-12', '1', null, 80], estoque: ['caixaria', 'Bloco C', null, null, 40], nota: 4.8, vendas: [140, 120, 133, 150, 210, 260, 180] },
  { sku: '300452', ean: '7890000000042', nome: 'Detergente neutro 500 ml', departamento: 'Limpeza', venda: ['R-15', '9', '4', 20], estoque: ['gaveta', 'Rua D', 'Gaveteiro 2', '14', 3], nota: 3.2, vendas: [6, 4, 0, 0, 0, 0, 0] },
] as const;

function diaMenos(hoje: string, n: number): string {
  const d = new Date(`${hoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function semear() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await aplicarMigracoes(pool);
    await pool.query('INSERT INTO lojas (id, nome) VALUES ($1, $2) ON CONFLICT DO NOTHING', [LOJA.id, LOJA.nome]);
    await pool.query("INSERT INTO aparelhos (id, loja_id, descricao) VALUES ('APARELHO-DEMO-01', $1, 'Celular de demonstração') ON CONFLICT DO NOTHING", [LOJA.id]);
    for (const [matricula, nome, papel, setor] of COLABORADORES) {
      await pool.query('INSERT INTO colaboradores (matricula, nome, loja_id, papel, setor) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [matricula, nome, LOJA.id, papel, setor]);
    }

    const hoje = hojeNaLoja();
    for (const p of PRODUTOS) {
      await pool.query('INSERT INTO produtos (sku, ean, nome, departamento) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [p.sku, p.ean, p.nome, p.departamento]);
      await pool.query('DELETE FROM enderecos_produto WHERE sku = $1 AND loja_id = $2', [p.sku, LOJA.id]);
      const [rua, modulo, nivel, qtd] = p.venda;
      await pool.query("INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, quantidade, principal, confirmado_em) VALUES ($1, $2, 'venda', $3, $4, $5, $6, true, now())", [p.sku, LOJA.id, rua, modulo, nivel, qtd]);
      const [tipo, ruaE, moduloE, nivelE, qtdE] = p.estoque;
      await pool.query('INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, quantidade, principal, confirmado_em) VALUES ($1, $2, $3, $4, $5, $6, $7, true, now())', [p.sku, LOJA.id, tipo, ruaE, moduloE, nivelE, qtdE]);
      for (const [i, unidades] of p.vendas.entries()) {
        await pool.query('INSERT INTO vendas_diarias (sku, loja_id, dia, unidades) VALUES ($1, $2, $3, $4) ON CONFLICT (sku, loja_id, dia) DO UPDATE SET unidades = EXCLUDED.unidades', [p.sku, LOJA.id, diaMenos(hoje, 6 - i), unidades]);
      }
      await pool.query('INSERT INTO apreciacao_produto (sku, loja_id, nota) VALUES ($1, $2, $3) ON CONFLICT (sku, loja_id) DO UPDATE SET nota = EXCLUDED.nota', [p.sku, LOJA.id, p.nota]);
      // Etiquetas de endereço para os lugares onde o produto está.
      for (const [t, r, m, n] of [['venda', rua, modulo, nivel], [tipo, ruaE, moduloE, nivelE]]) {
        await pool.query(
          `INSERT INTO locais (codigo, loja_id, tipo, rua, modulo, nivel, criado_por) VALUES ($1, $2, $3, $4, $5, $6, 'seed')
           ON CONFLICT (loja_id, tipo, rua, (COALESCE(modulo, '')), (COALESCE(nivel, '')), (COALESCE(posicao, ''))) DO NOTHING`,
          [novoCodigo(), LOJA.id, t, r, m, n],
        );
      }
    }
    // Uma caixa recebida esperando ser guardada.
    const { rows } = await pool.query("SELECT 1 FROM volumes WHERE loja_id = $1 AND local_id IS NULL", [LOJA.id]);
    if (!rows.length) {
      await pool.query("INSERT INTO volumes (codigo, loja_id, sku, quantidade, lote, validade, recebido_por) VALUES ($1, $2, '100245', 6, 'L2410', '2027-03-01', 'seed')", [novoCodigo(), LOJA.id]);
    }
    // Boa do Dia de hoje esperando o líder da Mercearia escolher quem faz.
    await pool.query(
      `INSERT INTO tarefas (loja_id, tipo, sku, setor, dia, instrucoes, criada_por) VALUES ($1, 'boa_do_dia', '100245', 'Mercearia', $2, 'Ponta de gôndola da entrada, com cartaz', '000100')
       ON CONFLICT (loja_id, dia, sku) WHERE tipo = 'boa_do_dia' DO NOTHING`,
      [LOJA.id, hoje],
    );
    console.log('Dados de demonstração gravados. Gere o código da gerente com: npm run codigo-inicial -- 000100');
  } finally {
    await pool.end();
  }
}

semear();
