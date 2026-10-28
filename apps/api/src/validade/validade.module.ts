import { Module } from '@nestjs/common';
import { ValidadeController } from './validade.controller';
import { ValidadeService } from './validade.service';

@Module({
  controllers: [ValidadeController],
  providers: [ValidadeService],
})
export class ValidadeModule {}
