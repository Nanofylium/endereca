import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { GerenteService } from './gerente.service';

@Controller('gerente')
@UseGuards(SessaoGuard)
@Papeis('gerente', 'admin')
export class GerenteController {
  constructor(private readonly gerente: GerenteService) {}

  @Get('setores')
  setores(@Req() req: RequisicaoAutenticada) {
    return this.gerente.setores(req.sessao);
  }

  @Get('aparelhos')
  aparelhos(@Req() req: RequisicaoAutenticada) {
    return this.gerente.aparelhos(req.sessao);
  }

  @Post('aparelhos/:id/bloquear')
  @HttpCode(HttpStatus.OK)
  bloquear(@Req() req: RequisicaoAutenticada, @Param('id') id: string) {
    return this.gerente.definirBloqueio(req.sessao, id, true);
  }

  @Post('aparelhos/:id/desbloquear')
  @HttpCode(HttpStatus.OK)
  desbloquear(@Req() req: RequisicaoAutenticada, @Param('id') id: string) {
    return this.gerente.definirBloqueio(req.sessao, id, false);
  }
}
