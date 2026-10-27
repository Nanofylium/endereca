import { DynamicModule, Module } from '@nestjs/common';
import { AcessoModule } from './auth/acesso.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { Config } from './config';
import { ConfigModule } from './config.module';
import { DbModule } from './db/db.module';
import { ErpModule } from './erp/erp.module';
import { EtiquetasModule } from './etiquetas/etiquetas.module';
import { GerenteModule } from './gerente/gerente.module';
import { GondolaModule } from './gondola/gondola.module';
import { LiderModule } from './lider/lider.module';
import { ProdutosModule } from './produtos/produtos.module';
import { RhModule } from './rh/rh.module';
import { TarefasModule } from './tarefas/tarefas.module';

@Module({})
export class AppModule {
  static com(config: Config): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.com(config), DbModule, AuditoriaModule, AcessoModule, RhModule, LiderModule, GerenteModule, ProdutosModule, ErpModule, EtiquetasModule, TarefasModule, GondolaModule],
    };
  }
}
