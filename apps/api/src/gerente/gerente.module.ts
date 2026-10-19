import { Module } from '@nestjs/common';
import { LiderModule } from '../lider/lider.module';
import { GerenteController } from './gerente.controller';
import { GerenteService } from './gerente.service';

@Module({
  imports: [LiderModule],
  controllers: [GerenteController],
  providers: [GerenteService],
})
export class GerenteModule {}
