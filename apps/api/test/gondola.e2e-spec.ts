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
  await http().post('/rh/sincronizar').set('x-rh-api-key', configTeste.rhApiKey).send({ lojas: [{ id: 'L1', nome: 'Loja 1' }, { id: 'L2', nome: 'Loja 2' }], colaboradores: EQUIPE }).expect(200);
  await http()
    .post('/erp/produtos')
    .set('x-erp-api-key', configTeste.erpApiKey!)
    .send({
      produtos: [
        {
          sku: '100245', ean: '7890000000011', nome: 'Arroz tipo 1 5 kg', departamento: 'Mercearia', unidadesEmbalagem: 6,
          lojas: [{ lojaId: 'L1', precoUnidade: 27.9, precoAtacado: 25.9, quantidadeAtacado: 6, precoEmbalagem: 155.4 }, { lojaId: 'L2', precoUnidade: 29.9 }],
        },
        { sku: '100388', ean: '7890000000059', nome: 'Feijão carioca 1 kg', departamento: 'Mercearia' },
      ],
    })
    .expect(200);
  await pool.query(`INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, posicao, quantidade, principal) VALUES
    ('100245', 'L1', 'venda', 'R-07', '5', '3', '1', 30, true), ('100245', 'L1', 'deposito', 'Rua B', '04', '2', null, 18, true)`);
});

describe('gôndola sem etiqueta de prateleira', () => {
  it('mostra o planograma do módulo com preço de varejo e de atacado', async () => {
    const repositor = await ativo('004512');
    expect((await repositor.get('/gondola/ruas')).body).toEqual([{ rua: 'R-07', modulo: '5', produtos: 1 }]);
    const { body } = await repositor.get('/gondola?rua=R-07&modulo=5').expect(200);
    expect(body.niveis).toEqual([
      {
        nivel: '3',
        produtos: [
          expect.objectContaining({ sku: '100245', posicao: '1', quantidade: 30, precoUnidade: 27.9, precoAtacado: 25.9, quantidadeAtacado: 6, conferirDeNovo: true }),
        ],
      },
    ]);
  });

  it('repositor bipa o EAN na prateleira: confirma, muda de lugar e troca quem ocupava a posição', async () => {
    const repositor = await ativo('004512');
    let r = await repositor.post('/gondola/conferir', { produto: '7890000000011', rua: 'R-07', modulo: '5', nivel: '3', posicao: '1', quantidade: 24 }).expect(200);
    expect(r.body).toMatchObject({ resultado: 'confirmado', endereco: 'R-07 · Módulo 5 · Nível 3 · Posição 1' });
    const ficha = await repositor.get('/gondola?rua=R-07&modulo=5');
    expect(ficha.body.niveis[0].produtos[0]).toMatchObject({ quantidade: 24, confirmadoPor: 'Carla Mendes', conferirDeNovo: false });

    r = await repositor.post('/gondola/conferir', { produto: '7890000000011', rua: 'R-08', modulo: '2', nivel: '1', posicao: '4' }).expect(200);
    expect(r.body).toMatchObject({ resultado: 'movido', antes: 'R-07 · Módulo 5 · Nível 3 · Posição 1' });

    r = await repositor.post('/gondola/conferir', { produto: '7890000000059', rua: 'R-08', modulo: '2', nivel: '1', posicao: '4' });
    expect(r.status).toBe(409);
    expect(r.body.motivo).toBe('posicao_ocupada');
    r = await repositor.post('/gondola/conferir', { produto: '7890000000059', rua: 'R-08', modulo: '2', nivel: '1', posicao: '4', substituir: true }).expect(200);
    expect(r.body).toMatchObject({ resultado: 'novo', substituido: { sku: '100245' } });
    const { rows } = await pool.query("SELECT sku FROM enderecos_produto WHERE tipo = 'venda' AND rua = 'R-08'");
    expect(rows).toEqual([{ sku: '100388' }]);
  });

  it('leitor de preço do cliente só funciona com a chave do gerente e mostra o preço da loja dele', async () => {
    const gerente = await ativo('000100');
    const repositor = await ativo('004512');
    expect((await repositor.post('/gondola/terminais', { descricao: 'Leitor R-07' })).status).toBe(403);

    const { body: terminal } = await gerente.post('/gondola/terminais', { descricao: 'Leitor R-07', rua: 'R-07' }).expect(201);
    expect(terminal.chave.length).toBeGreaterThanOrEqual(30);
    const { rows } = await pool.query('SELECT chave_hash FROM terminais_consulta');
    expect(rows[0].chave_hash).not.toBe(terminal.chave);

    const consulta = (chave?: string) => {
      const req = http().get('/consulta/7890000000011');
      return chave ? req.set('x-terminal-chave', chave) : req;
    };
    expect((await consulta()).status).toBe(401);
    expect((await consulta('x'.repeat(32))).status).toBe(401);
    const ok = await consulta(terminal.chave).expect(200);
    expect(ok.body).toMatchObject({ nome: 'Arroz tipo 1 5 kg', precoUnidade: 27.9, precoAtacado: 25.9, quantidadeAtacado: 6, onde: 'R-07 · Módulo 5 · Nível 3 · Posição 1' });

    expect((await gerente.get('/gondola/terminais')).body).toEqual([expect.objectContaining({ descricao: 'Leitor R-07', revogadoEm: null })]);
    await gerente.post(`/gondola/terminais/${terminal.id}/revogar`).expect(200);
    expect((await consulta(terminal.chave)).status).toBe(401);
  });
});
