import { ArrayMaxSize, IsArray, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class ResponderLicaoDto {
  /** Índice da opção escolhida em cada pergunta, na ordem. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(10, { each: true })
  respostas!: number[];
}

export class ResponderDesafioDto {
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9-]+$/)
  sku!: string;

  /** O endereço escolhido, como o app mostrou nas opções. */
  @IsString()
  @Length(1, 120)
  resposta!: string;
}
