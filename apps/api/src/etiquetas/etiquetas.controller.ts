import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Papeis, RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { CriarLocaisDto, GuardarVolumeDto, ReceberVolumesDto } from './etiquetas.dto';
import { EtiquetasService } from './etiquetas.service';

@Controller('etiquetas')
@UseGuards(SessaoGuard)
export class EtiquetasController {
  constructor(private readonly etiquetas: EtiquetasService) {}

  /** Líder ou gerente cadastra os endereços da loja e imprime as etiquetas fixas. */
  @Post('enderecos')
  @Papeis('lider', 'gerente', 'admin')
  criarLocais(@Req() req: RequisicaoAutenticada, @Body() dados: CriarLocaisDto) {
    return this.etiquetas.criarLocais(req.sessao, dados);
  }

  @Get('enderecos')
  @Papeis('lider', 'gerente', 'admin')
  listarLocais(@Req() req: RequisicaoAutenticada, @Query('tipo') tipo?: string) {
    return this.etiquetas.listarLocais(req.sessao, tipo);
  }

  /** Recebimento: gera uma etiqueta para cada caixa ou palete. */
  @Post('volumes')
  receber(@Req() req: RequisicaoAutenticada, @Body() dados: ReceberVolumesDto) {
    return this.etiquetas.receberVolumes(req.sessao, dados);
  }

  @Get('volumes/aguardando')
  aguardando(@Req() req: RequisicaoAutenticada) {
    return this.etiquetas.aguardando(req.sessao);
  }

  @Get('ler/:codigo')
  ler(@Req() req: RequisicaoAutenticada, @Param('codigo') codigo: string) {
    return this.etiquetas.ler(req.sessao, codigo);
  }

  /** Bipou o volume e depois o endereço onde o guardou. */
  @Post('guardar')
  @HttpCode(HttpStatus.OK)
  guardar(@Req() req: RequisicaoAutenticada, @Body() dados: GuardarVolumeDto) {
    return this.etiquetas.guardar(req.sessao, dados.volume, dados.endereco);
  }
}
