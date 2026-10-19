export interface Config {
  databaseUrl: string;
  jwtSecret: string;
  rhApiKey: string;
  port: number;
  /** Endereços do painel web autorizados a chamar a API pelo navegador. */
  origensPainel: string[];
}

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida`);
  return valor;
}

export function lerConfig(): Config {
  return {
    databaseUrl: obrigatoria('DATABASE_URL'),
    jwtSecret: obrigatoria('JWT_SECRET'),
    rhApiKey: obrigatoria('RH_API_KEY'),
    port: Number(process.env.PORT ?? 3000),
    origensPainel: (process.env.ORIGENS_PAINEL ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  };
}

export const CONFIG = Symbol('CONFIG');
