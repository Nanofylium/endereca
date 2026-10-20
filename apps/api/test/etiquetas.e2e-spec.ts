import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app';
import { aplicarMigracoes } from '../src/db/migrate';
import { emitirCodigo } from '../src/lider/emitir-codigo';
import { configTeste, TABELAS } from './ambiente';

const APARELHO = 'CELULAR-E1';

let app: INestApplication;
let pool: Pool;
const http = () => request(app.getHttpServer());

const EQUIPE = [
  { matricula: '001000', nome: 'Marcos Teixeira', lojaId: 'L1', papel: 'lider', setor: 'Mercearia', ativo: true },
  { matricula: '004512', nome: 'Carla Mendes', lojaId: 'L1', papel: 'repositor', setor: 'Mercearia', ativo: true },
  { matricula: '009001', nome: 'Outra Loja', lojaId: 'L2', papel: 'lider', setor: 'Mercearia', ativo: true },
];

async function ativo(matricula: string, aparelho = APARELHO) {
  const { codigo } = await emitirCodigo(pool, matricula, 'sistema', configTeste.jwtSecret);
  const res = await http().post('/acesso/ativar').set('x-aparelho-id', aparelho).send({ matricula, codigo, palavraSecreta: 'girassol' });
  expect(res.status).toBe(201);
  const token = res.body.token;
  return {
    get: (url: string) => http().get(url).set('authorization', `Bearer ${token}`).set('x-aparelho-id', aparelho),
    post: (url: string, corpo?: object) => http().post(url).set('authorization', `Bearer ${token}`).set('x-aparelho-id', aparelho).send(corpo),
  };
}

const importar = (produtos: object[], chave = configTeste.erpApiKey!) => http().post('/erp/produtos').set('x-erp-api-key', chave).send({ produtos });

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
    .send({ lojas: [{ id: 'L1', nome: 'Loja 1' }, { id: 'L2', nome: 'Loja 2' }], colaboradores: EQUIPE })
    .expect(200);
  await pool.query(`INSERT INTO aparelhos (id, loja_id, descricao) VALUES ($1, 'L1', 'Celular'), ('CELULAR-E2', 'L2', 'Celular L2')`, [APARELHO]);
  await importar([{ sku: '100245', ean: '7890000000011', nome: 'Arroz tipo 1 5 kg', departamento: 'Mercearia' }]).expect(200);
});

describe('catálogo do ERP', () => {
  it('importa e atualiza produtos pelo SKU', async () => {
    const res = await importar([
      { sku: '100245', ean: '7890000000011', nome: 'Arroz tipo 1 5 kg (novo)', departamento: 'Mercearia' },
      { sku: '200917', ean: '7890000000035', nome: 'Refrigerante cola 2 L', departamento: 'Bebidas' },
    ]);
    expect(res.body).toEqual({ novos: 1, atualizados: 1 });
    const { rows } = await pool.query('SELECT nome FROM produtos WHERE sku = $1', ['100245']);
    expect(rows[0].nome).toBe('Arroz tipo 1 5 kg (novo)');
  });

  it('recusa chave errada', async () => {
    expect((await importar([], 'errada')).status).toBe(401);
  });
});

describe('etiquetas de endereço e de volume', () => {
  const ENDERECOS = [
    { tipo: 'deposito', rua: 'Rua B', modulo: '04', nivel: '2' },
    { tipo: 'venda', rua: 'R-07', modulo: '5', nivel: '3' },
  ];

  it('líder cria as etiquetas de endereço e reimprimir devolve o mesmo código', async () => {
    const lider = await ativo('001000');
    const primeira = await lider.post('/etiquetas/enderecos', { locais: ENDERECOS });
    expect(primeira.status).toBe(201);
    expect(primeira.body[0]).toMatchObject({ tipo: 'deposito', nomeTipo: 'Depósito', descricao: 'Rua B · Módulo 04 · Nível 2' });
    expect(primeira.body[0].qr).toMatch(/^ENDERECA:L:[A-Z0-9]{10}$/);
    const segunda = await lider.post('/etiquetas/enderecos', { locais: [ENDERECOS[0]] });
    expect(segunda.body[0].codigo).toBe(primeira.body[0].codigo);
    expect((await lider.get('/etiquetas/enderecos')).body).toHaveLength(2);
  });

  it('repositor não cria etiqueta de endereço', async () => {
    const repositor = await ativo('004512');
    expect((await repositor.post('/etiquetas/enderecos', { locais: ENDERECOS })).status).toBe(403);
  });

  it('recebe volumes, guarda e o endereço aparece na ficha', async () => {
    const lider = await ativo('001000', 'CELULAR-E1');
    const [deposito, gondola] = (await lider.post('/etiquetas/enderecos', { locais: ENDERECOS })).body;
    const repositor = await ativo('004512', 'CELULAR-E1');

    const recebidos = await repositor.post('/etiquetas/volumes', { produto: '7890000000011', quantidade: 12, volumes: 2, lote: 'L2410', validade: '2027-03-01' });
    expect(recebidos.status).toBe(201);
    expect(recebidos.body).toHaveLength(2);
    expect(recebidos.body[0]).toMatchObject({ sku: '100245', produto: 'Arroz tipo 1 5 kg', quantidade: 12, guardado: null });
    expect((await repositor.get('/etiquetas/volumes/aguardando')).body).toHaveLength(2);

    const [caixa1, caixa2] = recebidos.body;
    const guardou = await repositor.post('/etiquetas/guardar', { volume: caixa1.qr, endereco: deposito.qr });
    expect(guardou.status).toBe(200);
    expect(guardou.body).toMatchObject({ movido: false, volume: { guardado: { local: { descricao: 'Rua B · Módulo 04 · Nível 2' }, por: '004512' } } });
    await repositor.post('/etiquetas/guardar', { volume: caixa2.qr, endereco: deposito.qr }).expect(200);

    const lido = await repositor.get(`/etiquetas/ler/${encodeURIComponent(deposito.qr)}`);
    expect(lido.body).toMatchObject({ tipo: 'endereco', produtos: [{ sku: '100245', quantidade: 24 }] });

    let ficha = await repositor.get('/produtos/ficha/100245');
    expect(ficha.body.estoque).toEqual([expect.objectContaining({ tipo: 'deposito', rua: 'Rua B', quantidade: 24, confirmadoPor: '004512' })]);
    expect(ficha.body.lote).toMatchObject({ lote: 'L2410', validade: '2027-03-01' });

    // Levar uma caixa para a gôndola tira a quantidade do depósito.
    const moveu = await repositor.post('/etiquetas/guardar', { volume: caixa1.qr, endereco: gondola.qr });
    expect(moveu.body.movido).toBe(true);
    ficha = await repositor.get('/produtos/ficha/100245');
    expect(ficha.body.estoque[0].quantidade).toBe(12);
    expect(ficha.body.areaDeVenda[0]).toMatchObject({ rua: 'R-07', quantidade: 12 });
    expect((await repositor.get('/etiquetas/volumes/aguardando')).body).toHaveLength(0);

    expect((await repositor.post('/etiquetas/guardar', { volume: caixa1.qr, endereco: gondola.qr })).status).toBe(409);
  });

  it('pede a ordem certa: primeiro o volume, depois o endereço', async () => {
    const lider = await ativo('001000');
    const [deposito] = (await lider.post('/etiquetas/enderecos', { locais: ENDERECOS })).body;
    const [caixa] = (await lider.post('/etiquetas/volumes', { produto: '100245', quantidade: 1 })).body;
    const res = await lider.post('/etiquetas/guardar', { volume: deposito.qr, endereco: caixa.qr });
    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('nao_e_volume');
  });

  it('não aceita etiqueta de outra loja', async () => {
    const lider = await ativo('001000');
    const [deposito] = (await lider.post('/etiquetas/enderecos', { locais: ENDERECOS })).body;
    const outra = await ativo('009001', 'CELULAR-E2');
    expect((await outra.get(`/etiquetas/ler/${encodeURIComponent(deposito.qr)}`)).status).toBe(404);
  });

  it('produto fora do catálogo pede importação do ERP', async () => {
    const repositor = await ativo('004512');
    const res = await repositor.post('/etiquetas/volumes', { produto: '7899999999999', quantidade: 1 });
    expect(res.status).toBe(404);
    expect(res.body.mensagem).toContain('ERP');
  });
});
