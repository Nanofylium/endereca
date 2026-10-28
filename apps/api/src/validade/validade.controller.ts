import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { JANELA_PADRAO_DIAS } from './projecao';
import { RegistrarAcaoDto } from './validade.dto';
import { ValidadeService } from './validade.service';

@Controller('validade')
@UseGuards(SessaoGuard)
@Papeis('lider', 'gerente', 'admin')
export class ValidadeController {
  constructor(private readonly validade: ValidadeService) {}

  /** Lotes que vencem nos próximos dias (até 120), com o que deve sobrar e o que fazer. */
  @Get('alertas')
  alertas(@Req() req: RequisicaoAutenticada, @Query('dias') dias?: string) {
    const janela = dias === undefined ? JANELA_PADRAO_DIAS : Number(dias);
    if (!Number.isInteger(janela)) throw new BadRequestException('dias deve ser um número inteiro');
    return this.validade.alertas(req.sessao, Math.min(Math.max(janela, 1), 120));
  }

  @Post('acoes')
  registrar(@Req() req: RequisicaoAutenticada, @Body() dados: RegistrarAcaoDto) {
    return this.validade.registrarAcao(req.sessao, dados);
  }
}
