import { Module } from '@nestjs/common';
import { LiderController } from './lider.controller';
import { LiderService } from './lider.service';

@Module({
  controllers: [LiderController],
  providers: [LiderService],
  exports: [LiderService],
})
export class LiderModule {}
