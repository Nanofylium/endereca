import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export const TIPOS_LOCAL = ['venda', 'deposito', 'caixaria', 'gaveta', 'intermedio', 'aereo'] as const;

export class LocalDto {
  @IsIn(TIPOS_LOCAL)
  tipo!: (typeof TIPOS_LOCAL)[number];

  @IsString()
  @Length(1, 30)
  rua!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  modulo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  nivel?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  posicao?: string;
}

export class CriarLocaisDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LocalDto)
  locais!: LocalDto[];
}

export class ReceberVolumesDto {
  /** EAN, SKU ou QR do produto. */
  @IsString()
  @Length(1, 60)
  produto!: string;

  /** Unidades em cada volume. */
  @IsInt()
  @Min(1)
  @Max(100000)
  quantidade!: number;

  /** Quantas caixas ou paletes iguais chegaram (uma etiqueta para cada). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  volumes?: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  lote?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  validade?: string;
}

export class GuardarVolumeDto {
  /** QR da etiqueta do volume. */
  @IsString()
  @Length(1, 60)
  volume!: string;

  /** QR da etiqueta do endereço onde o volume foi guardado. */
  @IsString()
  @Length(1, 60)
  endereco!: string;
}

export class BaixarVolumeDto {
  /** QR da etiqueta da caixa ou do palete que acabou. */
  @IsString()
  @Length(1, 60)
  volume!: string;
}
