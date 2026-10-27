import { Module } from '@nestjs/common';
import { GondolaController } from './gondola.controller';
import { GondolaService } from './gondola.service';
import { TerminalGuard } from './terminal.guard';

@Module({
  controllers: [GondolaController],
  providers: [GondolaService, TerminalGuard],
})
export class GondolaModule {}
