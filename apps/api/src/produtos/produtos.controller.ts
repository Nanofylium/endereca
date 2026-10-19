import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { RequisicaoAutenticada, SessaoGuard } from '../auth/sessao.guard';
import { ProdutosService } from './produtos.service';

@Controller('produtos')
@UseGuards(SessaoGuard)
export class ProdutosController {
  constructor(private readonly produtos: ProdutosService) {}

  @Get()
  buscar(@Req() req: RequisicaoAutenticada, @Query('q') q = '') {
    return this.produtos.buscar(req.sessao.loja, q);
  }

  /** Aceita o conteúdo do QR Code (ENDERECA:P:<sku>), o EAN ou o SKU. */
  @Get('ficha/:codigo')
  ficha(@Req() req: RequisicaoAutenticada, @Param('codigo') codigo: string) {
    return this.produtos.ficha(req.sessao.loja, codigo);
  }
}
