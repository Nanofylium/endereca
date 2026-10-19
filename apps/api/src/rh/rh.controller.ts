import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SincronizacaoRhDto } from './rh.dto';
import { ChaveRhGuard } from './rh.guard';
import { ResultadoSincronizacao, RhService } from './rh.service';

@Controller('rh')
@UseGuards(ChaveRhGuard)
export class RhController {
  constructor(private readonly rh: RhService) {}

  @Post('sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizar(@Body() dados: SincronizacaoRhDto): Promise<ResultadoSincronizacao> {
    return this.rh.sincronizar(dados);
  }
}
