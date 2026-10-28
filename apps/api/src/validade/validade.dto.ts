import { IsIn, IsISO8601, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ACOES_VENCIMENTO, AcaoVencimento } from './projecao';

export class RegistrarAcaoDto {
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9-]+$/)
  sku!: string;

  /** Como veio no alerta; vazio quando a caixa não tem lote. */
  @IsString()
  @Length(0, 60)
  lote!: string;

  @IsISO8601({ strict: true })
  validade!: string;

  @IsIn(ACOES_VENCIMENTO)
  acao!: AcaoVencimento;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  observacao?: string;
}
