import { Module } from '@nestjs/common';
import { ErpController } from './erp.controller';
import { ChaveErpGuard } from './erp.guard';
import { ErpService } from './erp.service';

@Module({
  controllers: [ErpController],
  providers: [ErpService, ChaveErpGuard],
})
export class ErpModule {}
