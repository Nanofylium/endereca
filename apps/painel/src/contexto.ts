import { Api, ErroApi } from './api';
import { Papel } from './tipos';

export interface Contexto {
  api: Api;
  papel: Papel;
  aoSessaoCair: (e: ErroApi) => void;
}
