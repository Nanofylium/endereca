import { IsString, Length, Matches } from 'class-validator';
import { MATRICULA_REGEX } from './tipos';

export class EntrarDto {
  @Matches(MATRICULA_REGEX, { message: 'Matrícula inválida.' })
  matricula!: string;

  @IsString()
  @Length(1, 128)
  palavraSecreta!: string;
}

export class AtivarDto extends EntrarDto {
  @IsString()
  @Length(4, 12)
  codigo!: string;
}
