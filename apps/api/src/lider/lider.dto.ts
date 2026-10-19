import { Matches } from 'class-validator';
import { MATRICULA_REGEX } from '../auth/tipos';

export class GerarCodigoDto {
  @Matches(MATRICULA_REGEX, { message: 'Matrícula inválida.' })
  matricula!: string;
}
