import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { AtribuirDto, BoaDoDiaDto, ConcluirDto, FaltaDto } from './tarefas.dto';
import { TarefasService } from './tarefas.service';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
@UseGuards(SessaoGuard)
export class TarefasController {
  constructor(private readonly tarefas: TarefasService) {}

  /** Gerente operacional envia a Boa do Dia para o setor. */
  @Post('tarefas/boa-do-dia')
  @Papeis('gerente', 'admin')
  boaDoDia(@Req() req: RequisicaoAutenticada, @Body() dados: BoaDoDiaDto) {
    return this.tarefas.enviarBoaDoDia(req.sessao, dados);
  }

  @Get('tarefas')
  @Papeis('lider', 'gerente', 'admin')
  listar(@Req() req: RequisicaoAutenticada, @Query('dia') dia?: string) {
    return this.tarefas.listar(req.sessao, dia && DIA.test(dia) ? dia : undefined);
  }

  @Get('tarefas/minhas')
  minhas(@Req() req: RequisicaoAutenticada) {
    return this.tarefas.minhas(req.sessao);
  }

  /** O líder decide quem vai fazer. */
  @Post('tarefas/:id/atribuir')
  @Papeis('lider', 'gerente', 'admin')
  @HttpCode(HttpStatus.OK)
  atribuir(@Req() req: RequisicaoAutenticada, @Param('id') id: string, @Body() dados: AtribuirDto) {
    return this.tarefas.atribuir(req.sessao, id, dados.matricula);
  }

  @Post('tarefas/:id/concluir')
  @HttpCode(HttpStatus.OK)
  concluir(@Req() req: RequisicaoAutenticada, @Param('id') id: string, @Body() dados: ConcluirDto) {
    return this.tarefas.concluir(req.sessao, id, dados.resultado, dados.observacao);
  }

  /** Não tem o produto na gôndola para escanear. */
  @Post('faltas')
  registrarFalta(@Req() req: RequisicaoAutenticada, @Body() dados: FaltaDto) {
    return this.tarefas.registrarFalta(req.sessao, dados.produto, dados.observacao?.trim() || null);
  }

  @Get('faltas')
  @Papeis('lider', 'gerente', 'admin')
  faltas(@Req() req: RequisicaoAutenticada) {
    return this.tarefas.faltas(req.sessao);
  }

  @Post('faltas/:id/resolver')
  @Papeis('lider', 'gerente', 'admin')
  @HttpCode(HttpStatus.OK)
  resolver(@Req() req: RequisicaoAutenticada, @Param('id') id: string) {
    return this.tarefas.resolverFalta(req.sessao, id);
  }
}
