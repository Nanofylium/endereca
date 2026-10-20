import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ImportacaoErpDto } from './erp.dto';
import { ChaveErpGuard } from './erp.guard';
import { ErpService } from './erp.service';

@Controller('erp')
@UseGuards(ChaveErpGuard)
export class ErpController {
  constructor(private readonly erp: ErpService) {}

  @Post('produtos')
  @HttpCode(HttpStatus.OK)
  importar(@Body() dados: ImportacaoErpDto) {
    return this.erp.importar(dados);
  }
}
