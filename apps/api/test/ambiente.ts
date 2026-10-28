import { Config } from '../src/config';

export const configTeste: Config = {
  databaseUrl: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/endereca_test',
  jwtSecret: 'segredo-de-teste',
  rhApiKey: 'chave-rh-teste',
  erpApiKey: 'chave-erp-teste',
  port: 0,
  origensPainel: ['http://localhost:5173'],
};

export const TABELAS = `lojas, colaboradores, aparelhos, codigos_ativacao, tentativas_acesso, avisos_lider, auditoria,
  produtos, enderecos_produto, vendas_diarias, lotes_produto, apreciacao_produto, locais, volumes, tarefas, faltas,
  produto_loja, conjuntos_produto, leituras_produto, terminais_consulta,
  treino_licoes, treino_desafios, acoes_vencimento`;
