import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { TRILHA } from '../src/treino/conteudo';
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
    ('100245', '7890000000011', 'Arroz tipo 1 5 kg', 'Mercearia'), ('100388', '7890000000059', 'Feijão carioca 1 kg', 'Mercearia'),
    ('300001', '7890000000099', 'Pão de forma', 'Padaria')`);
  await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, principal) VALUES
    ('100245', 'L1', 'venda', 'R-07', '5', '3', true), ('100388', 'L1', 'venda', 'R-08', '2', '2', true),
    ('300001', 'L1', 'venda', 'R-01', null, null, true), ('100245', 'L1', 'deposito', 'Rua B', '04', '2', true)`);
});

describe('treinamento do repositor', () => {
  it('lição corrige as respostas, guarda a melhor tentativa e sobe de nível', async () => {
    const carla = await ativo('004512');
    let resumo = (await carla.get('/treino').expect(200)).body;
    expect(resumo).toMatchObject({ pontos: 0, nivel: { atual: { nome: 'Aprendiz' } } });
    expect(resumo.licoes).toHaveLength(TRILHA.length);
    expect(resumo.carreira[0].cargo).toBe('Repositor');

    const licao = (await carla.get('/treino/licoes/enderecos').expect(200)).body;
    expect(licao.topicos.length).toBeGreaterThan(2);
    expect(JSON.stringify(licao)).not.toContain('correta');
    expect((await carla.get('/treino/licoes/nao-existe')).status).toBe(404);
    expect((await carla.post('/treino/licoes/enderecos', { respostas: [1] })).status).toBe(400);

    // Erra uma: 1 de 2 não passa. Depois acerta tudo: vale a melhor.
    let r = (await carla.post('/treino/licoes/enderecos', { respostas: [1, 2] }).expect(200)).body;
    expect(r).toMatchObject({ acertos: 1, total: 2, aprovado: false, ganhou: 10 });
    expect(r.correcoes[1]).toMatchObject({ acertou: false, correta: 0 });
    r = (await carla.post('/treino/licoes/enderecos', { respostas: [1, 0] }).expect(200)).body;
    expect(r).toMatchObject({ acertos: 2, aprovado: true, pontos: 20, ganhou: 10 });
    r = (await carla.post('/treino/licoes/enderecos', { respostas: [0, 0] }).expect(200)).body;
    expect(r).toMatchObject({ pontos: 20, ganhou: 0 });

    // Todas as lições certas: passa de Aprendiz para Repositor.
    let subiu: string | null = null;
    for (const l of TRILHA) {
      const res = (await carla.post(`/treino/licoes/${l.id}`, { respostas: l.perguntas.map((p) => p.correta) }).expect(200)).body;
      subiu = res.subiuDeNivel ?? subiu;
    }
    expect(subiu).toBe('Repositor');
    resumo = (await carla.get('/treino').expect(200)).body;
    expect(resumo.licoes.every((l: { concluida: boolean }) => l.concluida)).toBe(true);
  });

  it('desafio usa um produto de verdade da loja e dá pontos só no acerto', async () => {
    const carla = await ativo('004512');
    const d = (await carla.get('/treino/desafio').expect(200)).body;
    expect(['100245', '100388', '300001']).toContain(d.sku);
    expect(d.opcoes).toHaveLength(3);
    const certo = { '100245': 'R-07 · Módulo 5 · Nível 3', '100388': 'R-08 · Módulo 2 · Nível 2', '300001': 'R-01' }[d.sku as string]!;
    expect(d.opcoes).toContain(certo);

    let r = (await carla.post('/treino/desafio', { sku: d.sku, resposta: 'Rua que não existe' }).expect(200)).body;
    expect(r).toMatchObject({ acertou: false, correta: certo, ganhou: 0 });
    r = (await carla.post('/treino/desafio', { sku: d.sku, resposta: certo }).expect(200)).body;
    expect(r).toMatchObject({ acertou: true, ganhou: 5, pontos: 5 });
  });

  it('líder acompanha o treino só do próprio setor', async () => {
    const carla = await ativo('004512');
    await carla.post('/treino/licoes/seguranca', { respostas: [1, 1] }).expect(200);
    const lider = await ativo('001000');
    const equipe = (await lider.get('/treino/equipe').expect(200)).body;
    expect(equipe.map((p: { matricula: string }) => p.matricula).sort()).toEqual(['004512', '007001']);
    expect(equipe.find((p: { matricula: string }) => p.matricula === '004512')).toMatchObject({ pontos: 20, licoesConcluidas: 1, nivel: 'Aprendiz' });
    expect((await (await ativo('000100')).get('/treino/equipe')).body).toHaveLength(3);
    expect((await carla.get('/treino/equipe')).status).toBe(403);
  });
});
