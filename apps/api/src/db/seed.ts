/**
 * Dados de demonstração, os mesmos do protótipo. Não use em produção: lá as matrículas vêm só do RH.
 * Uso: npm run seed
 */
import { Pool } from 'pg';
import { hojeNaLoja } from '../produtos/indicadores';
import { aplicarMigracoes } from './migrate';

const LOJA = { id: 'L001', nome: 'Loja de demonstração' };

const COLABORADORES: [string, string, string][] = [
  ['001000', 'Marcos Teixeira', 'lider'],
  ['004512', 'Carla Mendes', 'repositor'],
  ['003871', 'Bruno Lima', 'repositor'],
  ['005093', 'Ana Souza', 'repositor'],
  ['007001', 'Ivo Ramos', 'repositor'],
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
    for (const [matricula, nome, papel] of COLABORADORES) {
      await pool.query('INSERT INTO colaboradores (matricula, nome, loja_id, papel) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [matricula, nome, LOJA.id, papel]);
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
    }
    console.log('Dados de demonstração gravados. Gere o código do líder com: npm run codigo-inicial -- 001000');
  } finally {
    await pool.end();
  }
}

semear();
