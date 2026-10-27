import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { ConferirDto, CriarTerminalDto } from './gondola.dto';
import { GondolaService } from './gondola.service';
import { RequisicaoTerminal, TerminalGuard } from './terminal.guard';

/** Gôndola sem etiqueta de prateleira: planograma digital para a equipe e leitor de preço para o cliente. */
@Controller()
export class GondolaController {
  constructor(private readonly gondola: GondolaService) {}

  @Get('gondola/ruas')
  @UseGuards(SessaoGuard)
  ruas(@Req() req: RequisicaoAutenticada) {
    return this.gondola.ruas(req.sessao);
  }

  @Get('gondola')
  @UseGuards(SessaoGuard)
  modulo(@Req() req: RequisicaoAutenticada, @Query('rua') rua = '', @Query('modulo') modulo?: string) {
    return this.gondola.modulo(req.sessao, rua, modulo ?? null);
  }

  @Post('gondola/conferir')
  @UseGuards(SessaoGuard)
  @HttpCode(HttpStatus.OK)
  conferir(@Req() req: RequisicaoAutenticada, @Body() dados: ConferirDto) {
    return this.gondola.conferir(req.sessao, dados);
  }

  @Get('gondola/terminais')
  @UseGuards(SessaoGuard)
  @Papeis('gerente', 'admin')
  terminais(@Req() req: RequisicaoAutenticada) {
    return this.gondola.terminais(req.sessao);
  }

  @Post('gondola/terminais')
  @UseGuards(SessaoGuard)
  @Papeis('gerente', 'admin')
  criarTerminal(@Req() req: RequisicaoAutenticada, @Body() dados: CriarTerminalDto) {
    return this.gondola.criarTerminal(req.sessao, dados);
  }

  @Post('gondola/terminais/:id/revogar')
  @UseGuards(SessaoGuard)
  @Papeis('gerente', 'admin')
  @HttpCode(HttpStatus.OK)
  revogarTerminal(@Req() req: RequisicaoAutenticada, @Param('id') id: string) {
    return this.gondola.revogarTerminal(req.sessao, id);
  }

  /** Leitor de preço do cliente na área de venda. */
  @Get('consulta/:codigo')
  @UseGuards(TerminalGuard)
  consultar(@Req() req: RequisicaoTerminal, @Param('codigo') codigo: string) {
    return this.gondola.consultar(req.terminal.lojaId, codigo);
  }
}
