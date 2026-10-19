import { Module } from '@nestjs/common';
import { RhController } from './rh.controller';
import { ChaveRhGuard } from './rh.guard';
import { RhService } from './rh.service';

@Module({
  controllers: [RhController],
  providers: [RhService, ChaveRhGuard],
})
export class RhModule {}
