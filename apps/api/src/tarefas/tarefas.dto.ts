import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MATRICULA_REGEX } from '../auth/tipos';

export class BoaDoDiaDto {
  /** EAN, SKU ou QR do produto. */
  @IsString()
  @Length(1, 60)
  produto!: string;

  /** Setor que vai executar. Sem ele, vale o departamento do produto. */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  setor?: string;

  /** Dia da oferta. Sem ele, hoje. */
  @IsOptional()
  @IsISO8601({ strict: true })
  dia?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  instrucoes?: string;
}

export class AtribuirDto {
  @Matches(MATRICULA_REGEX, { message: 'Matrícula inválida.' })
  matricula!: string;
}

export class ConcluirDto {
  @IsIn(['feito', 'sem_produto'])
  resultado!: 'feito' | 'sem_produto';

  @IsOptional()
  @IsString()
  @Length(1, 500)
  observacao?: string;
}

export class FaltaDto {
  @IsString()
  @Length(1, 60)
  produto!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  observacao?: string;
}

export class LimitesDto {
  /** EAN, SKU ou QR do produto. */
  @IsString()
  @Length(1, 60)
  produto!: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  minimo!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maximo?: number;
}
