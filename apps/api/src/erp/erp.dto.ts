import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';

export class ProdutoErpDto {
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'SKU inválido.' })
  sku!: string;

  @IsOptional()
  @Matches(/^\d{8,14}$/, { message: 'EAN inválido.' })
  ean?: string;

  @IsString()
  @Length(1, 160)
  nome!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  marca?: string;

  @IsString()
  @Length(1, 60)
  departamento!: string;

  /** false quando o item saiu de linha. */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class ImportacaoErpDto {
  @IsArray()
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => ProdutoErpDto)
  produtos!: ProdutoErpDto[];
}
