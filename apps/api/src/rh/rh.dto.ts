import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { MATRICULA_REGEX, Papel } from '../auth/tipos';

export class LojaRhDto {
  @IsString()
  @Length(1, 20)
  id!: string;

  @IsString()
  @Length(1, 120)
  nome!: string;
}

export class ColaboradorRhDto {
  @Matches(MATRICULA_REGEX, { message: 'Matrícula inválida.' })
  matricula!: string;

  @IsString()
  @Length(1, 120)
  nome!: string;

  @IsString()
  @Length(1, 20)
  lojaId!: string;

  @IsIn(['repositor', 'lider', 'admin'])
  papel!: Papel;

  /** false quando o colaborador foi desligado ou afastado. */
  @IsBoolean()
  ativo!: boolean;
}

export class SincronizacaoRhDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LojaRhDto)
  lojas?: LojaRhDto[];

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ColaboradorRhDto)
  colaboradores!: ColaboradorRhDto[];
}
