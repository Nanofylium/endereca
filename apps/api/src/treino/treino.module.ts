import { Module } from '@nestjs/common';
import { TreinoController } from './treino.controller';
import { TreinoService } from './treino.service';

@Module({
  controllers: [TreinoController],
  providers: [TreinoService],
})
export class TreinoModule {}
