import { describe, expect, it } from 'vitest';
import { iniciais, quando, textoMotivo } from './formatar';

describe('formatação do painel', () => {
  const agora = new Date(2026, 9, 19, 15, 0);

  it('diz quando algo aconteceu de forma curta', () => {
    expect(quando(new Date(2026, 9, 19, 9, 42).toISOString(), agora)).toBe('hoje, 09:42');
    expect(quando(new Date(2026, 9, 18, 17, 30).toISOString(), agora)).toBe('ontem, 17:30');
    expect(quando(new Date(2026, 9, 12, 8, 15).toISOString(), agora)).toBe('12/10, 08:15');
    expect(quando(null, agora)).toBe('Nunca');
  });

  it('traduz os motivos de recusa', () => {
    expect(textoMotivo('matricula_inexistente')).toBe('Matrícula fora do cadastro do RH');
    expect(textoMotivo('desconhecido')).toBe('desconhecido');
  });

  it('pega as iniciais do nome', () => {
    expect(iniciais('Carla Mendes')).toBe('CM');
    expect(iniciais('Rita Maria de Albuquerque')).toBe('RA');
    expect(iniciais('Ivo')).toBe('I');
  });
});
