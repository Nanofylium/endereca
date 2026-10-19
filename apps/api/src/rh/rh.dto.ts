import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { MATRICULA_REGEX, Papel, PAPEIS_VALIDOS } from '../auth/tipos';

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

  @IsIn(PAPEIS_VALIDOS)
  papel!: Papel;

  /** Setor de trabalho (mercearia, padaria, açougue...). O líder enxerga só a equipe do seu setor. */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  setor?: string;

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
