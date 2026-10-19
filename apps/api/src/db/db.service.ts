import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { CONFIG, Config } from '../config';

// Colunas DATE chegam como 'AAAA-MM-DD', sem conversão de fuso.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

export type Executor = Pick<PoolClient, 'query'>;

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(@Inject(CONFIG) config: Config) {
    this.pool = new Pool({ connectionString: config.databaseUrl });
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = [], executor: Executor = this.pool): Promise<T[]> {
    const resultado = await executor.query<T>(sql, params);
    return resultado.rows;
  }

  async transacao<T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await fn(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (erro) {
      await cliente.query('ROLLBACK');
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
