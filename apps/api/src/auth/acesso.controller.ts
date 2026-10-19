import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AtivarDto, EntrarDto } from './acesso.dto';
import { AcessoService, ErroAcesso, RespostaAcesso } from './acesso.service';
import { CABECALHO_APARELHO } from './sessao.guard';

function exigirAparelho(aparelhoId: string | undefined): string {
  if (!aparelhoId) throw new ErroAcesso(HttpStatus.FORBIDDEN, 'aparelho_nao_autorizado', 'Este aparelho não está autorizado. Use um celular da loja.');
  return aparelhoId;
}

@Controller('acesso')
export class AcessoController {
  constructor(private readonly acesso: AcessoService) {}

  @Post('ativar')
  ativar(@Body() dto: AtivarDto, @Headers(CABECALHO_APARELHO) aparelhoId?: string): Promise<RespostaAcesso> {
    return this.acesso.ativar({ ...dto, aparelhoId: exigirAparelho(aparelhoId) });
  }

  @Post('entrar')
  @HttpCode(HttpStatus.OK)
  entrar(@Body() dto: EntrarDto, @Headers(CABECALHO_APARELHO) aparelhoId?: string): Promise<RespostaAcesso> {
    return this.acesso.entrar({ ...dto, aparelhoId: exigirAparelho(aparelhoId) });
  }
}
