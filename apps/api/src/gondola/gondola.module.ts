import { Module } from '@nestjs/common';
import { TarefasModule } from '../tarefas/tarefas.module';
import { GondolaController } from './gondola.controller';
import { GondolaService } from './gondola.service';
import { TerminalGuard } from './terminal.guard';

@Module({
  imports: [TarefasModule],
  controllers: [GondolaController],
  providers: [GondolaService, TerminalGuard],
})
export class GondolaModule {}
