import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { ResponderDesafioDto, ResponderLicaoDto } from './treino.dto';
import { TreinoService } from './treino.service';

@Controller('treino')
@UseGuards(SessaoGuard)
export class TreinoController {
  constructor(private readonly treino: TreinoService) {}

  @Get()
  resumo(@Req() req: RequisicaoAutenticada) {
    return this.treino.resumo(req.sessao);
  }

  @Get('licoes/:id')
  licao(@Param('id') id: string) {
    return this.treino.licao(id);
  }

  @Post('licoes/:id')
  @HttpCode(HttpStatus.OK)
  responder(@Req() req: RequisicaoAutenticada, @Param('id') id: string, @Body() dados: ResponderLicaoDto) {
    return this.treino.responder(req.sessao, id, dados.respostas);
  }

  /** "Ache o produto": um produto de verdade da loja e quatro endereços para escolher. */
  @Get('desafio')
  desafio(@Req() req: RequisicaoAutenticada) {
    return this.treino.desafio(req.sessao);
  }

  @Post('desafio')
  @HttpCode(HttpStatus.OK)
  responderDesafio(@Req() req: RequisicaoAutenticada, @Body() dados: ResponderDesafioDto) {
    return this.treino.responderDesafio(req.sessao, dados.sku, dados.resposta);
  }

  @Get('equipe')
  @Papeis('lider', 'gerente', 'admin')
  equipe(@Req() req: RequisicaoAutenticada) {
    return this.treino.equipe(req.sessao);
  }
}
