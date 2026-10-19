import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { hojeNaLoja } from '../src/produtos/indicadores';
import { configTeste, TABELAS } from './ambiente';

const config = configTeste;

const APARELHO = 'APARELHO-L1';
const APARELHO_L2 = 'APARELHO-L2';

let app: INestApplication;
let pool: Pool;
const http = () => request(app.getHttpServer());

async function sincronizarRh(colaboradores: object[]) {
  return http()
    .post('/rh/sincronizar')
    .set('x-rh-api-key', config.rhApiKey)
    .send({ lojas: [{ id: 'L1', nome: 'Loja 1' }, { id: 'L2', nome: 'Loja 2' }], colaboradores });
}

async function ativar(matricula: string, codigo: string, palavraSecreta = 'chiclete', aparelho = APARELHO) {
  return http().post('/acesso/ativar').set('x-aparelho-id', aparelho).send({ matricula, codigo, palavraSecreta });
}

async function entrar(matricula: string, palavraSecreta: string, aparelho = APARELHO) {
  return http().post('/acesso/entrar').set('x-aparelho-id', aparelho).send({ matricula, palavraSecreta });
}

/** Ativa um líder pelo caminho do primeiro acesso da loja (código gerado pela TI). */
async function liderAtivo(matricula: string, aparelho = APARELHO): Promise<string> {
  const { codigo } = await emitirCodigo(pool, matricula, 'sistema', config.jwtSecret);
  const res = await ativar(matricula, codigo, 'girassol', aparelho);
  expect(res.status).toBe(201);
  return res.body.token;
}

beforeAll(async () => {
  pool = new Pool({ connectionString: config.databaseUrl });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await aplicarMigracoes(pool);
  app = await criarApp(config);
  await app.init();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query(`TRUNCATE ${TABELAS} CASCADE`);
  const res = await sincronizarRh([
    { matricula: '001000', nome: 'Marcos Teixeira', lojaId: 'L1', papel: 'lider', setor: 'Mercearia', ativo: true },
    { matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
    { matricula: '007001', nome: 'Ivo Ramos', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
    { matricula: '009000', nome: 'Paula Reis', lojaId: 'L2', papel: 'lider', ativo: true },
  ]);
  expect(res.body).toEqual({ novos: 4, atualizados: 0, desligados: 0 });
  await pool.query(`INSERT INTO aparelhos (id, loja_id, descricao) VALUES ($1, 'L1', 'Celular 1'), ($2, 'L2', 'Celular L2')`, [APARELHO, APARELHO_L2]);
});

describe('integração com o RH', () => {
  it('recusa sincronização sem a chave do RH', async () => {
    const res = await http().post('/rh/sincronizar').send({ colaboradores: [] });
    expect(res.status).toBe(401);
  });

  it('não existe rota para criar matrícula fora do RH', async () => {
    const res = await http().post('/colaboradores').send({ matricula: '123456', nome: 'Falso' });
    expect(res.status).toBe(404);
  });
});

describe('primeiro acesso', () => {
  it('recusa matrícula que não está no cadastro do RH', async () => {
    const res = await ativar('999999', 'ABC234');
    expect(res.status).toBe(401);
    expect(res.body.motivo).toBe('matricula_inexistente');
  });

  it('recusa aparelho que não é da loja', async () => {
    const res = await ativar('007001', 'ABC234', 'chiclete', 'CELULAR-PESSOAL');
    expect(res.status).toBe(403);
    expect(res.body.motivo).toBe('aparelho_nao_autorizado');
  });

  it('ativa com o código do líder, uma única vez, e depois entra com a palavra', async () => {
    const tokenLider = await liderAtivo('001000');

    const gerado = await http()
      .post('/lider/codigos-ativacao')
      .set('authorization', `Bearer ${tokenLider}`)
      .set('x-aparelho-id', APARELHO)
      .send({ matricula: '007001' });
    expect(gerado.status).toBe(201);
    expect(gerado.body.codigo).toMatch(/^[A-Z2-9]{6}$/);

    const { rows } = await pool.query('SELECT codigo_hash FROM codigos_ativacao WHERE matricula = $1', ['007001']);
    expect(rows[0].codigo_hash).not.toContain(gerado.body.codigo);

    expect((await ativar('007001', 'ZZZZZZ')).body.motivo).toBe('codigo_invalido');
    expect((await ativar('007001', gerado.body.codigo, '12345678')).body.motivo).toBe('palavra_fraca');

    const ativado = await ativar('007001', gerado.body.codigo);
    expect(ativado.status).toBe(201);
    expect(ativado.body.colaborador).toMatchObject({ matricula: '007001', papel: 'repositor' });

    expect((await ativar('007001', gerado.body.codigo, 'outrapalavra')).status).toBe(409);

    const login = await entrar('007001', 'Chiclete');
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('o código de uma matrícula não serve para outra', async () => {
    const { codigo } = await emitirCodigo(pool, '007001', 'sistema', config.jwtSecret);
    expect((await ativar('004512', codigo)).body.motivo).toBe('codigo_invalido');
  });

  it('código vencido não ativa', async () => {
    const { codigo } = await emitirCodigo(pool, '007001', 'sistema', config.jwtSecret);
    await pool.query("UPDATE codigos_ativacao SET expira_em = now() - interval '1 minute'");
    expect((await ativar('007001', codigo)).body.motivo).toBe('codigo_invalido');
  });

  it('matrícula de outra loja não ativa neste aparelho', async () => {
    const { codigo } = await emitirCodigo(pool, '009000', 'sistema', config.jwtSecret);
    expect((await ativar('009000', codigo)).body.motivo).toBe('loja_diferente');
  });
});

describe('painel do líder', () => {
  it('repositor não gera código de ativação', async () => {
    const { codigo } = await emitirCodigo(pool, '004512', 'sistema', config.jwtSecret);
    const token = (await ativar('004512', codigo)).body.token;
    const res = await http()
      .post('/lider/codigos-ativacao')
      .set('authorization', `Bearer ${token}`)
      .set('x-aparelho-id', APARELHO)
      .send({ matricula: '007001' });
    expect(res.status).toBe(403);
  });

  it('líder não gera código para matrícula de outra loja', async () => {
    const token = await liderAtivo('009000', APARELHO_L2);
    const res = await http()
      .post('/lider/codigos-ativacao')
      .set('authorization', `Bearer ${token}`)
      .set('x-aparelho-id', APARELHO_L2)
      .send({ matricula: '007001' });
    expect(res.status).toBe(404);
  });

  it('lista pendentes e tentativas recusadas da loja', async () => {
    const token = await liderAtivo('001000');
    await ativar('999999', 'ABC234');

    const auth = (r: request.Test) => r.set('authorization', `Bearer ${token}`).set('x-aparelho-id', APARELHO);
    const pendentes = await auth(http().get('/lider/pendentes'));
    expect(pendentes.body.map((p: { matricula: string }) => p.matricula)).toEqual(['004512', '007001']);

    const recusadas = await auth(http().get('/lider/tentativas-recusadas'));
    expect(recusadas.body).toEqual([expect.objectContaining({ matricula: '999999', motivo: 'matricula_inexistente' })]);
  });

  it('token usado em outro aparelho é recusado', async () => {
    const token = await liderAtivo('001000');
    const res = await http().get('/lider/pendentes').set('authorization', `Bearer ${token}`).set('x-aparelho-id', 'OUTRO');
    expect(res.status).toBe(401);
  });
});

describe('bloqueio e desligamento', () => {
  it('três palavras erradas bloqueiam por 15 minutos e avisam o líder', async () => {
    const { codigo } = await emitirCodigo(pool, '004512', 'sistema', config.jwtSecret);
    await ativar('004512', codigo);

    expect((await entrar('004512', 'errada1')).status).toBe(401);
    expect((await entrar('004512', 'errada2')).status).toBe(401);
    expect((await entrar('004512', 'errada3')).status).toBe(429);
    // Nem a palavra certa entra durante o bloqueio.
    expect((await entrar('004512', 'chiclete')).status).toBe(429);

    const avisos = await pool.query('SELECT tipo, texto FROM avisos_lider');
    expect(avisos.rows).toEqual([expect.objectContaining({ tipo: 'acesso_bloqueado', texto: expect.stringContaining('004512') })]);
  });

  it('matrículas inventadas em sequência travam o aparelho', async () => {
    for (const m of ['900001', '900002', '900003', '900004', '900005']) await ativar(m, 'ABC234');
    const res = await ativar('007001', 'ABC234');
    expect(res.body.motivo).toBe('bloqueado');
  });

  it('desligamento no RH derruba a sessão aberta e impede novo login', async () => {
    const { codigo } = await emitirCodigo(pool, '004512', 'sistema', config.jwtSecret);
    const token = (await ativar('004512', codigo)).body.token;
    const ficha = () => http().get('/produtos?q=arroz').set('authorization', `Bearer ${token}`).set('x-aparelho-id', APARELHO);
    expect((await ficha()).status).toBe(200);

    const sync = await sincronizarRh([{ matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', ativo: false }]);
    expect(sync.body.desligados).toBe(1);

    expect((await ficha()).body.motivo).toBe('sessao_revogada');
    expect((await entrar('004512', 'chiclete')).body.motivo).toBe('matricula_inexistente');
  });
});

describe('ficha do produto', () => {
  it('lê o QR Code e devolve endereço R-, estoque, dias sem venda, apreciação e previsão', async () => {
    const { codigo } = await emitirCodigo(pool, '004512', 'sistema', config.jwtSecret);
    const token = (await ativar('004512', codigo)).body.token;

    await pool.query("INSERT INTO produtos (sku, ean, nome, departamento) VALUES ('100245', '7890000000011', 'Arroz tipo 1 5 kg', 'Mercearia')");
    await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, quantidade, principal) VALUES
      ('100245', 'L1', 'venda', 'R-07', '5', '3', 30, true),
      ('100245', 'L1', 'deposito', 'Rua B', '04', '2', 18, true)`);
    const hoje = hojeNaLoja();
    await pool.query("INSERT INTO vendas_diarias (sku, loja_id, dia, unidades) VALUES ('100245', 'L1', $1::date - 1, 70), ('100245', 'L1', $1::date - 2, 70)", [hoje]);
    await pool.query("INSERT INTO apreciacao_produto (sku, loja_id, nota) VALUES ('100245', 'L1', 4.6)");

    const res = await http()
      .get(`/produtos/ficha/${encodeURIComponent('ENDERECA:P:100245')}`)
      .set('authorization', `Bearer ${token}`)
      .set('x-aparelho-id', APARELHO);

    expect(res.status).toBe(200);
    expect(res.body.produto.nome).toBe('Arroz tipo 1 5 kg');
    expect(res.body.areaDeVenda[0]).toMatchObject({ rua: 'R-07', modulo: '5', nivel: '3' });
    expect(res.body.estoque[0]).toMatchObject({ tipo: 'deposito', rua: 'Rua B' });
    expect(res.body.quantidadeGondola).toBe(30);
    expect(res.body.diasSemVenda).toBe(1);
    expect(res.body.totalVendas7Dias).toBe(140);
    expect(res.body.apreciacao.nota).toBe(4.6);
    expect(res.body.previsao).toMatchObject({ alerta: 'ok', diasAteEsvaziar: 1.5 });

    const porEan = await http().get('/produtos/ficha/7890000000011').set('authorization', `Bearer ${token}`).set('x-aparelho-id', APARELHO);
    expect(porEan.body.produto.sku).toBe('100245');
  });

  it('sem sessão não mostra a ficha', async () => {
    expect((await http().get('/produtos/ficha/100245')).status).toBe(401);
  });
});
