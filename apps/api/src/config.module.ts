import { DynamicModule, Global, Module } from '@nestjs/common';
import { CONFIG, Config } from './config';

@Global()
@Module({})
export class ConfigModule {
  static com(config: Config): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] };
  }
}
