import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { hojeNaLoja } from '../src/produtos/indicadores';
import { configTeste, TABELAS } from './ambiente';

let app: INestApplication;
let pool: Pool;
const http = () => request(app.getHttpServer());

const EQUIPE = [
  { matricula: '000100', nome: 'Rita Gerente', lojaId: 'L1', papel: 'gerente', ativo: true },
  { matricula: '001000', nome: 'Marcos Teixeira', lojaId: 'L1', papel: 'lider', setor: 'Mercearia', ativo: true },
  { matricula: '002000', nome: 'Sueli Prado', lojaId: 'L1', papel: 'lider', setor: 'Padaria', ativo: true },
  { matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
];

function daqui(dias: number): string {
  const d = new Date(`${hojeNaLoja()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function ativo(matricula: string) {
  const aparelho = `AP-${matricula}`;
  await pool.query("INSERT INTO aparelhos (id, loja_id, descricao) VALUES ($1, 'L1', 'Aparelho') ON CONFLICT DO NOTHING", [aparelho]);
  const { codigo } = await emitirCodigo(pool, matricula, 'sistema', configTeste.jwtSecret);
  const res = await http().post('/acesso/ativar').set('x-aparelho-id', aparelho).send({ matricula, codigo, palavraSecreta: 'girassol' });
  expect(res.status).toBe(201);
  const token = res.body.token;
  return {
    get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`).set('x-aparelho-id', aparelho),
    post: (url: string, corpo?: object) => http().post(url).set('authorization', `Bearer ${token}`).set('x-aparelho-id', aparelho).send(corpo),
  };
}

beforeAll(async () => {
  pool = new Pool({ connectionString: configTeste.databaseUrl });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await aplicarMigracoes(pool);
  app = await criarApp(configTeste);
  await app.init();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query(`TRUNCATE ${TABELAS} CASCADE`);
  await http().post('/rh/sincronizar').set('x-rh-api-key', configTeste.rhApiKey).send({ lojas: [{ id: 'L1', nome: 'Loja 1' }], colaboradores: EQUIPE }).expect(200);
  await pool.query(`INSERT INTO produtos (sku, ean, nome, departamento) VALUES
    ('100245', '7890000000011', 'Arroz tipo 1 5 kg', 'Mercearia'), ('200310', '7890000000042', 'Iogurte morango 170 g', 'Mercearia'),
    ('300001', '7890000000099', 'Pão de forma', 'Padaria')`);
  await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, quantidade, principal) VALUES
    ('100245', 'L1', 'venda', 'R-07', '5', '3', 20, true), ('200310', 'L1', 'venda', 'R-02', '1', '1', 10, true),
    ('300001', 'L1', 'venda', 'R-01', null, null, 5, true)`);
  await pool.query(`INSERT INTO produto_loja (sku, loja_id, preco_unidade) VALUES ('100245', 'L1', 25.90), ('200310', 'L1', 3.50), ('300001', 'L1', 8.00)`);
  await pool.query(`INSERT INTO lotes_produto (sku, loja_id, lote, fornecedor) VALUES ('200310', 'L1', 'IOG-9', 'Laticínios Serra')`);
  // Arroz vende 10 por dia; iogurte, 1 por dia.
  for (let i = 0; i < 7; i++) {
    await pool.query("INSERT INTO vendas_diarias (sku, loja_id, dia, unidades) VALUES ('100245', 'L1', $1, 10), ('200310', 'L1', $1, 1)", [daqui(-i)]);
  }
  const [{ id: local }] = (
    await pool.query("INSERT INTO locais (codigo, loja_id, tipo, rua, modulo, nivel, criado_por) VALUES ('LOC1', 'L1', 'deposito', 'Rua B', '04', '2', '001000') RETURNING id")
  ).rows;
  await pool.query(
    `INSERT INTO volumes (codigo, loja_id, sku, quantidade, lote, validade, recebido_por, local_id) VALUES
      ('CX-ARROZ-1', 'L1', '100245', 50, 'A1', $1, '004512', $4),
      ('CX-IOG-1', 'L1', '200310', 30, 'IOG-9', $2, '004512', $4),
      ('CX-IOG-2', 'L1', '200310', 12, 'IOG-8', $3, '004512', null),
      ('CX-PAO-1', 'L1', '300001', 20, 'P1', $2, '004512', null),
      ('CX-ARROZ-LONGE', 'L1', '100245', 60, 'A9', $5, '004512', $4)`,
    [daqui(10), daqui(5), daqui(-1), local, daqui(200)],
  );
});

describe('alerta de vencimento', () => {
  it('mostra o que deve sobrar, o valor em risco e o que fazer, só do setor do líder', async () => {
    const marcos = await ativo('001000');
    const r = (await marcos.get('/validade/alertas').expect(200)).body;
    expect(r.alertas.map((a: { sku: string; lote: string }) => `${a.sku}/${a.lote}`)).toEqual(['200310/IOG-8', '200310/IOG-9', '100245/A1']);

    const [vencido, iogurte, arroz] = r.alertas;
    expect(vencido).toMatchObject({ diasParaVencer: -1, sobra: 12, sugestao: 'retirar', valorEmRisco: 42, caixas: [{ codigo: 'CX-IOG-2', local: 'Aguardando guardar' }] });
    // Iogurte: 5 dias × 1 = 5 vendidas; a gôndola (10) e o lote vencido (12) vão antes. Sobram as 30.
    expect(iogurte).toMatchObject({ diasParaVencer: 5, sobra: 30, sugestao: 'rebaixar', valorEmRisco: 105, fornecedor: 'Laticínios Serra' });
    expect(iogurte.caixas[0].local).toBe('Depósito · Rua B · Módulo 04 · Nível 2');
    // Arroz: 10 dias × 10 = 100; a gôndola (20) e as 50 do lote vendem a tempo.
    expect(arroz).toMatchObject({ sobra: 0, sugestao: 'vende_a_tempo', valorEmRisco: 0 });
    expect(r.valorEmRisco).toBe(147);

    // A janela vai no máximo a 120 dias, então o lote de daqui a 200 dias nunca entra.
    const largo = (await marcos.get('/validade/alertas?dias=500').expect(200)).body;
    expect(largo.janelaDias).toBe(120);
    expect(largo.alertas.map((a: { lote: string }) => a.lote)).not.toContain('A9');
    expect((await marcos.get('/validade/alertas?dias=abc')).status).toBe(400);

    // A gerente vê a loja toda, com o pão da padaria.
    const rita = await ativo('000100');
    const loja = (await rita.get('/validade/alertas').expect(200)).body;
    expect(loja.alertas.map((a: { sku: string }) => a.sku)).toContain('300001');

    // Repositor não vê o alerta.
    const carla = await ativo('004512');
    expect((await carla.get('/validade/alertas')).status).toBe(403);
  });

  it('registra a decisão do líder, marca como tratado e grava na auditoria', async () => {
    const marcos = await ativo('001000');
    const decisao = { sku: '200310', lote: 'IOG-9', validade: daqui(5), acao: 'rebaixar', observacao: ' 30% na ponta da R-02 ' };
    await marcos.post('/validade/acoes', decisao).expect(201);

    const r = (await marcos.get('/validade/alertas').expect(200)).body;
    const iogurte = r.alertas.find((a: { lote: string }) => a.lote === 'IOG-9');
    expect(iogurte.tratado).toMatchObject({ acao: 'rebaixar', observacao: '30% na ponta da R-02', por: 'Marcos Teixeira' });
    expect(r.alertas[r.alertas.length - 1].lote).toBe('IOG-9');
    expect(r.valorEmRisco).toBe(42);

    const { rows } = await pool.query("SELECT autor, detalhes FROM auditoria WHERE acao = 'vencimento.acao'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ autor: '001000', detalhes: { sku: '200310', acao: 'rebaixar' } });

    // Ação inválida, lote que não existe e produto de outro setor.
    expect((await marcos.post('/validade/acoes', { ...decisao, acao: 'jogar_fora' })).status).toBe(400);
    expect((await marcos.post('/validade/acoes', { ...decisao, lote: 'NAO-EXISTE' })).status).toBe(404);
    expect((await marcos.post('/validade/acoes', { sku: '300001', lote: 'P1', validade: daqui(5), acao: 'destacar' })).status).toBe(403);
    const sueli = await ativo('002000');
    await sueli.post('/validade/acoes', { sku: '300001', lote: 'P1', validade: daqui(5), acao: 'destacar' }).expect(201);
  });
});
