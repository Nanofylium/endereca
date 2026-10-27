import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

const CODIGO = /^[A-Za-z0-9._-]+$/;

/** Kit, fardo misto ou combo de que o produto faz parte. */
export class ConjuntoErpDto {
  @Matches(CODIGO, { message: 'Código de conjunto inválido.' })
  @Length(1, 40)
  codigo!: string;

  @IsString()
  @Length(1, 120)
  nome!: string;

  /** Quantas unidades deste produto vão no conjunto. */
  @IsInt()
  @Min(1)
  quantidade!: number;
}

/** O que muda de loja para loja: preço e última compra. */
export class ProdutoLojaErpDto {
  @IsString()
  @Length(1, 40)
  lojaId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999)
  precoUnidade?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999)
  precoEmbalagem?: number;

  /** Preço de atacado, que vale a partir de quantidadeAtacado unidades. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999)
  precoAtacado?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  quantidadeAtacado?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  ultimaCompraEm?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ultimaCompraQuantidade?: number;
}

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

  @IsOptional()
  @Matches(CODIGO, { message: 'Código interno inválido.' })
  @Length(1, 40)
  codigoInterno?: string;

  /** Classe do produto no ERP, por exemplo a curva A, B ou C. */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  classe?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  setorSave?: string;

  /** Unidades por embalagem (caixa ou fardo). */
  @IsOptional()
  @IsInt()
  @Min(1)
  unidadesEmbalagem?: number;

  /** Caixas por camada do palete. */
  @IsOptional()
  @IsInt()
  @Min(1)
  lastro?: number;

  /** Camadas por palete. */
  @IsOptional()
  @IsInt()
  @Min(1)
  altura?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  vidaUtilDias?: number;

  /** Quando vem, substitui os conjuntos do produto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConjuntoErpDto)
  conjuntos?: ConjuntoErpDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ProdutoLojaErpDto)
  lojas?: ProdutoLojaErpDto[];

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
