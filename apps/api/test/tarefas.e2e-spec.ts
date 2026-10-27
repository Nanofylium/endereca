import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { configTeste, TABELAS } from './ambiente';

let app: INestApplication;
let pool: Pool;
const http = () => request(app.getHttpServer());

const EQUIPE = [
  { matricula: '000100', nome: 'Rita Gerente', lojaId: 'L1', papel: 'gerente', ativo: true },
  { matricula: '001000', nome: 'Marcos Teixeira', lojaId: 'L1', papel: 'lider', setor: 'Mercearia', ativo: true },
  { matricula: '002000', nome: 'Sueli Prado', lojaId: 'L1', papel: 'lider', setor: 'Padaria', ativo: true },
  { matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
  { matricula: '007001', nome: 'Ivo Ramos', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
  { matricula: '008001', nome: 'Davi Nogueira', lojaId: 'L1', papel: 'repositor', setor: 'Padaria', ativo: true },
];

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
    ('100245', '7890000000011', 'Arroz tipo 1 5 kg', 'Mercearia'), ('300001', '7890000000099', 'Pão de forma', 'Padaria')`);
  await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, quantidade, principal) VALUES
    ('100245', 'L1', 'venda', 'R-07', '5', '3', 0, true), ('100245', 'L1', 'deposito', 'Rua B', '04', '2', 18, true),
    ('300001', 'L1', 'venda', 'R-01', null, null, 0, true)`);
});

describe('Boa do Dia', () => {
  it('gerente envia, líder do setor escolhe quem faz e o repositor conclui', async () => {
    const gerente = await ativo('000100');
    const enviada = await gerente.post('/tarefas/boa-do-dia', { produto: '7890000000011', instrucoes: 'Ponta de gôndola da entrada' });
    expect(enviada.status).toBe(201);
    expect(enviada.body).toMatchObject({ produto: 'Arroz tipo 1 5 kg', setor: 'Mercearia', situacao: 'aguardando_lider', responsavel: null });
    expect(enviada.body.estoque).toEqual([{ nomeTipo: 'Depósito', descricao: 'Rua B · Módulo 04 · Nível 2', quantidade: 18 }]);
    expect((await gerente.post('/tarefas/boa-do-dia', { produto: '100245' })).status).toBe(409);

    const lider = await ativo('001000');
    expect((await lider.get('/tarefas')).body).toHaveLength(1);
    const outraLider = await ativo('002000');
    expect((await outraLider.get('/tarefas')).body).toHaveLength(0);

    const id = enviada.body.id;
    expect((await lider.post(`/tarefas/${id}/atribuir`, { matricula: '008001' })).status).toBe(403);
    const atribuida = await lider.post(`/tarefas/${id}/atribuir`, { matricula: '004512' });
    expect(atribuida.body).toMatchObject({ situacao: 'atribuida', responsavel: { matricula: '004512', nome: 'Carla Mendes' } });

    const outro = await ativo('007001');
    expect((await outro.post(`/tarefas/${id}/concluir`, { resultado: 'feito' })).status).toBe(403);

    const carla = await ativo('004512');
    expect((await carla.get('/tarefas/minhas')).body).toEqual([expect.objectContaining({ id, situacao: 'atribuida' })]);
    const feita = await carla.post(`/tarefas/${id}/concluir`, { resultado: 'feito' });
    expect(feita.status).toBe(200);
    expect(feita.body).toMatchObject({ tarefa: { situacao: 'concluida' }, falta: null });
    expect((await carla.post(`/tarefas/${id}/concluir`, { resultado: 'feito' })).status).toBe(409);
  });

  it('líder de outro setor não atribui e repositor não envia Boa do Dia', async () => {
    const gerente = await ativo('000100');
    const { body } = await gerente.post('/tarefas/boa-do-dia', { produto: '100245' });
    const sueli = await ativo('002000');
    expect((await sueli.post(`/tarefas/${body.id}/atribuir`, { matricula: '008001' })).status).toBe(403);
    const carla = await ativo('004512');
    expect((await carla.post('/tarefas/boa-do-dia', { produto: '100245' })).status).toBe(403);
  });

  it('sem produto para a Boa do Dia vira aviso de falta', async () => {
    const gerente = await ativo('000100');
    const { body } = await gerente.post('/tarefas/boa-do-dia', { produto: '300001' });
    await gerente.post(`/tarefas/${body.id}/atribuir`, { matricula: '008001' }).expect(200);
    const davi = await ativo('008001');
    const res = await davi.post(`/tarefas/${body.id}/concluir`, { resultado: 'sem_produto', observacao: 'Não chegou da padaria' });
    expect(res.body).toMatchObject({ tarefa: { situacao: 'sem_produto' }, falta: { sku: '300001', estoque: [] } });
    const sueli = await ativo('002000');
    expect((await sueli.get('/faltas')).body).toEqual([expect.objectContaining({ sku: '300001', estoque: 0, observacao: 'Não chegou da padaria' })]);
  });
});

describe('produto em falta na gôndola', () => {
  it('mostra onde ainda há estoque para buscar', async () => {
    const carla = await ativo('004512');
    const res = await carla.post('/faltas', { produto: '7890000000011' });
    expect(res.status).toBe(201);
    expect(res.body.estoque).toEqual([expect.objectContaining({ descricao: 'Rua B · Módulo 04 · Nível 2', quantidade: 18 })]);
    expect(res.body.mensagem).toContain('18 un.');
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM avisos_lider WHERE tipo = 'falta'");
    expect(rows[0].n).toBe(0);
  });

  it('sem estoque avisa o líder, que resolve depois', async () => {
    const davi = await ativo('008001');
    const res = await davi.post('/faltas', { produto: '300001' });
    expect(res.body.mensagem).toContain('líder foi avisado');
    const marcos = await ativo('001000');
    expect((await marcos.get('/faltas')).body).toHaveLength(0);
    const sueli = await ativo('002000');
    const [falta] = (await sueli.get('/faltas')).body;
    expect((await marcos.post(`/faltas/${falta.id}/resolver`)).status).toBe(403);
    await sueli.post(`/faltas/${falta.id}/resolver`).expect(200);
    expect((await sueli.get('/faltas')).body).toHaveLength(0);
  });
});
