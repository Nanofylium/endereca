import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { GerarCodigoDto } from './lider.dto';
import { LiderService } from './lider.service';

function inicioDoDia(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Rotas do painel do líder. O gerente operacional e o administrador também as usam, com escopo maior. */
@Controller('lider')
@UseGuards(SessaoGuard)
@Papeis('lider', 'gerente', 'admin')
export class LiderController {
  constructor(private readonly lider: LiderService) {}

  @Get('equipe')
  equipe(@Req() req: RequisicaoAutenticada) {
    return this.lider.equipe(req.sessao);
  }

  @Get('pendentes')
  pendentes(@Req() req: RequisicaoAutenticada) {
    return this.lider.pendentes(req.sessao);
  }

  @Post('codigos-ativacao')
  gerarCodigo(@Req() req: RequisicaoAutenticada, @Body() dto: GerarCodigoDto) {
    return this.lider.gerarCodigo(req.sessao, dto.matricula);
  }

  @Get('tentativas-recusadas')
  tentativasRecusadas(@Req() req: RequisicaoAutenticada, @Query('desde') desde?: string) {
    const data = desde ? new Date(desde) : inicioDoDia();
    return this.lider.tentativasRecusadas(req.sessao, Number.isNaN(data.getTime()) ? inicioDoDia() : data);
  }

  @Get('avisos')
  avisos(@Req() req: RequisicaoAutenticada) {
    return this.lider.avisos(req.sessao);
  }

  @Get('produtos-em-alerta')
  produtosEmAlerta(@Req() req: RequisicaoAutenticada) {
    return this.lider.produtosEmAlerta(req.sessao);
  }
}
