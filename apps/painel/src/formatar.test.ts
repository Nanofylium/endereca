import { describe, expect, it } from 'vitest';
import { candidatosTarefa, diaMes, iniciais, quando, reais, textoMotivo, textoVencimento } from './formatar';
import { MembroEquipe } from './tipos';

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

describe('quem pode receber a Boa do Dia', () => {
  const membro = (matricula: string, papel: MembroEquipe['papel'], setor: string | null, situacao: MembroEquipe['situacao'] = 'ativo'): MembroEquipe => ({
    matricula, nome: matricula, papel, setor, situacao, ultimoAcesso: null, codigoValidoAte: null, podeLiberar: false,
  });
  const equipe = [
    membro('L1', 'lider', 'Mercearia'),
    membro('R1', 'repositor', 'mercearia '),
    membro('R2', 'repositor', 'Padaria'),
    membro('R3', 'repositor', 'Mercearia', 'pendente'),
    membro('G1', 'gerente', null),
  ];

  it('líder escolhe a própria equipe ou a si mesmo', () => {
    expect(candidatosTarefa(equipe, 'Mercearia', 'lider', 'L1').map((m) => m.matricula)).toEqual(['L1', 'R1']);
  });

  it('gerente vê quem é do setor, ou todos quando o setor não tem ninguém', () => {
    expect(candidatosTarefa(equipe, 'Mercearia', 'gerente', 'G1').map((m) => m.matricula)).toEqual(['L1', 'R1']);
    expect(candidatosTarefa(equipe, 'Bebidas', 'gerente', 'G1').map((m) => m.matricula)).toEqual(['L1', 'R1', 'R2']);
  });
});

describe('vencimento', () => {
  it('fala quantos dias faltam ou passaram', () => {
    expect(textoVencimento(-3)).toBe('venceu há 3 dias');
    expect(textoVencimento(-1)).toBe('venceu ontem');
    expect(textoVencimento(0)).toBe('vence hoje');
    expect(textoVencimento(1)).toBe('vence amanhã');
    expect(textoVencimento(12)).toBe('vence em 12 dias');
    expect(diaMes('2026-11-02')).toBe('02/11');
    expect(reais(105).replace(/\s/g, ' ')).toBe('R$ 105,00');
  });
});
