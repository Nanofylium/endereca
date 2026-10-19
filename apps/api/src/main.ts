import 'reflect-metadata';
import { criarApp } from './app';
import { lerConfig } from './config';

async function iniciar() {
  const config = lerConfig();
  const app = await criarApp(config);
  await app.listen(config.port);
  console.log(`API do Endereça ouvindo na porta ${config.port}`);
}

iniciar();
