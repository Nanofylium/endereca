import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { hojeNaLoja } from '../src/produtos/indicadores';
import { configTeste, TABELAS } from './ambiente';

const APARELHO = 'TABLET-L1';
const APARELHO_2 = 'CELULAR-L1';

let app: INestApplication;
let pool: Pool;
const http = () => request(app.getHttpServer());

const EQUIPE = [
  { matricula: '000100', nome: 'Rita Gerente', lojaId: 'L1', papel: 'gerente', ativo: true },
  { matricula: '001000', nome: 'Marcos Teixeira', lojaId: 'L1', papel: 'lider', setor: 'Mercearia', ativo: true },
  { matricula: '002000', nome: 'Sueli Pão', lojaId: 'L1', papel: 'lider', setor: 'Padaria', ativo: true },
  { matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
  { matricula: '007001', nome: 'Ivo Ramos', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
  { matricula: '008001', nome: 'Davi Forno', lojaId: 'L1', papel: 'repositor', setor: 'Padaria', ativo: true },
];

async function ativo(matricula: string, aparelho = APARELHO): Promise<string> {
  const { codigo } = await emitirCodigo(pool, matricula, 'sistema', configTeste.jwtSecret);
  const res = await http().post('/acesso/ativar').set('x-aparelho-id', aparelho).send({ matricula, codigo, palavraSecreta: 'girassol' });
  expect(res.status).toBe(201);
  return res.body.token;
}

function como(token: string, aparelho = APARELHO) {
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
  await http()
    .post('/rh/sincronizar')
    .set('x-rh-api-key', configTeste.rhApiKey)
    .send({ lojas: [{ id: 'L1', nome: 'Loja 1' }], colaboradores: EQUIPE })
    .expect(200);
  await pool.query(`INSERT INTO aparelhos (id, loja_id, descricao) VALUES ($1, 'L1', 'Tablet do líder'), ($2, 'L1', 'Celular 2')`, [APARELHO, APARELHO_2]);
});

describe('painel do líder', () => {
  it('mostra só a equipe do próprio setor', async () => {
    const lider = como(await ativo('001000'));
    const res = await lider.get('/lider/equipe');
    expect(res.status).toBe(200);
    expect(res.body.map((m: { matricula: string }) => m.matricula)).toEqual(['004512', '007001', '001000']);
    expect(res.body.find((m: { matricula: string }) => m.matricula === '001000').situacao).toBe('ativo');
    expect(res.body.find((m: { matricula: string }) => m.matricula === '004512')).toMatchObject({ situacao: 'pendente', podeLiberar: true });
  });

  it('não libera repositor de outro setor', async () => {
    const lider = como(await ativo('001000'));
    const res = await lider.post('/lider/codigos-ativacao', { matricula: '008001' });
    expect(res.status).toBe(403);
    expect(res.body.mensagem).toContain('gerente operacional');
  });

  it('não libera outro líder', async () => {
    const lider = como(await ativo('001000'));
    expect((await lider.post('/lider/codigos-ativacao', { matricula: '002000' })).status).toBe(403);
  });

  it('mostra produtos do setor parados ou prestes a faltar', async () => {
    const hoje = hojeNaLoja();
    await pool.query(`INSERT INTO produtos (sku, nome, departamento) VALUES
      ('A', 'Arroz 5 kg', 'Mercearia'), ('B', 'Detergente', 'Mercearia'), ('C', 'Pão francês', 'Padaria'), ('D', 'Feijão', 'Mercearia')`);
    await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, quantidade) VALUES
      ('A', 'L1', 'venda', 'R-07', '5', 10), ('B', 'L1', 'venda', 'R-15', '9', 20), ('C', 'L1', 'venda', 'R-01', null, 5), ('D', 'L1', 'venda', 'R-08', null, 500)`);
    // A: vende 70/dia com 10 na gôndola (repor agora). B: última venda há 5 dias (parado). D: abastecido.
    await pool.query(`INSERT INTO vendas_diarias (sku, loja_id, dia, unidades) VALUES
      ('A', 'L1', $1::date, 70), ('A', 'L1', $1::date - 1, 70), ('A', 'L1', $1::date - 2, 70), ('A', 'L1', $1::date - 3, 70),
      ('A', 'L1', $1::date - 4, 70), ('A', 'L1', $1::date - 5, 70), ('A', 'L1', $1::date - 6, 70),
      ('B', 'L1', $1::date - 5, 3), ('C', 'L1', $1::date - 6, 1), ('D', 'L1', $1::date, 10)`, [hoje]);

    const lider = como(await ativo('001000'));
    const res = await lider.get('/lider/produtos-em-alerta');
    expect(res.body).toEqual([
      expect.objectContaining({ sku: 'A', enderecoVenda: 'R-07 · Módulo 5', previsao: expect.objectContaining({ alerta: 'repor_agora' }) }),
      expect.objectContaining({ sku: 'B', diasSemVenda: 5, previsao: expect.objectContaining({ alerta: 'parado' }) }),
    ]);

    const gerente = como(await ativo('000100', APARELHO_2), APARELHO_2);
    const todos = await gerente.get('/lider/produtos-em-alerta');
    expect(todos.body.map((p: { sku: string }) => p.sku)).toEqual(['A', 'B', 'C']);
  });

  it('repositor não abre o painel', async () => {
    const repositor = como(await ativo('004512'));
    expect((await repositor.get('/lider/equipe')).status).toBe(403);
    expect((await repositor.get('/gerente/setores')).status).toBe(403);
  });

  it('líder rebaixado pelo RH perde o painel na hora', async () => {
    const lider = como(await ativo('001000'));
    await http()
      .post('/rh/sincronizar')
      .set('x-rh-api-key', configTeste.rhApiKey)
      .send({ colaboradores: [{ ...EQUIPE[1], papel: 'repositor' }] })
      .expect(200);
    expect((await lider.get('/lider/equipe')).status).toBe(403);
  });
});

describe('painel do gerente operacional', () => {
  it('vê todos os setores com líderes e situação de acesso', async () => {
    await ativo('001000', APARELHO_2);
    const gerente = como(await ativo('000100'));
    const res = await gerente.get('/gerente/setores');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ setor: 'Mercearia', lideres: ['Marcos Teixeira'], total: 3, ativos: 1, pendentes: 2 }),
      expect.objectContaining({ setor: 'Padaria', lideres: ['Sueli Pão'], total: 2, ativos: 0, pendentes: 2 }),
    ]);
  });

  it('libera líderes e repositores de qualquer setor', async () => {
    const gerente = como(await ativo('000100'));
    expect((await gerente.post('/lider/codigos-ativacao', { matricula: '002000' })).status).toBe(201);
    expect((await gerente.post('/lider/codigos-ativacao', { matricula: '008001' })).status).toBe(201);
    const pendentes = await gerente.get('/lider/pendentes');
    expect(pendentes.body.map((m: { matricula: string }) => m.matricula)).toEqual(expect.arrayContaining(['001000', '002000', '004512', '007001', '008001']));
  });

  it('bloquear um aparelho perdido derruba as sessões abertas nele', async () => {
    const gerente = como(await ativo('000100'));
    const repositor = como(await ativo('004512', APARELHO_2), APARELHO_2);
    expect((await repositor.get('/produtos?q=arroz')).status).toBe(200);

    const res = await gerente.post(`/gerente/aparelhos/${APARELHO_2}/bloquear`);
    expect(res.body).toEqual({ id: APARELHO_2, ativo: false });
    expect((await repositor.get('/produtos?q=arroz')).body.motivo).toBe('sessao_revogada');

    const aparelhos = await gerente.get('/gerente/aparelhos');
    expect(aparelhos.body.find((a: { id: string }) => a.id === APARELHO_2)).toMatchObject({ ativo: false, bloqueado_por: '000100' });

    await gerente.post(`/gerente/aparelhos/${APARELHO_2}/desbloquear`).expect(200);
    const login = await http().post('/acesso/entrar').set('x-aparelho-id', APARELHO_2).send({ matricula: '004512', palavraSecreta: 'girassol' });
    expect(login.status).toBe(200);
  });

  it('não bloqueia o aparelho que está usando', async () => {
    const gerente = como(await ativo('000100'));
    expect((await gerente.post(`/gerente/aparelhos/${APARELHO}/bloquear`)).status).toBe(409);
  });

  it('líder não abre as rotas do gerente', async () => {
    const lider = como(await ativo('001000'));
    expect((await lider.get('/gerente/aparelhos')).status).toBe(403);
  });
});
