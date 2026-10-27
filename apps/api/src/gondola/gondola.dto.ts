import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ConferirDto {
  /** EAN de fábrica do produto (ou SKU), bipado direto na embalagem. */
  @IsString()
  @Length(1, 60)
  produto!: string;

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

  /** Quantas unidades estão na frente agora, se o repositor contou. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  quantidade?: number;

  /** Outro produto ocupava a posição e saiu de lá. */
  @IsOptional()
  @IsBoolean()
  substituir?: boolean;
}

export class CriarTerminalDto {
  @IsString()
  @Length(1, 80)
  descricao!: string;

  /** Rua da área de venda onde o leitor fica. */
  @IsOptional()
  @IsString()
  @Length(1, 30)
  rua?: string;
}
