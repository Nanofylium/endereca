import { podeGerir } from './escopo';
import { SessaoAtual } from './tipos';

const sessao = (papel: SessaoAtual['papel'], setor: string | null = 'Mercearia'): SessaoAtual => ({ sub: '001000', loja: 'L1', papel, setor, tv: 0, ap: 'A' });
const alvo = (papel: SessaoAtual['papel'], setor: string | null = 'Mercearia', loja_id = 'L1') => ({ matricula: '004512', papel, setor, loja_id });

describe('quem libera o acesso de quem', () => {
  it('líder libera repositores do próprio setor', () => {
    expect(podeGerir(sessao('lider'), alvo('repositor'))).toBe(true);
    expect(podeGerir(sessao('lider', ' mercearia '), alvo('repositor', 'MERCEARIA'))).toBe(true);
  });

  it('líder não libera outro setor, outros líderes nem sem setor', () => {
    expect(podeGerir(sessao('lider'), alvo('repositor', 'Padaria'))).toBe(false);
    expect(podeGerir(sessao('lider'), alvo('lider'))).toBe(false);
    expect(podeGerir(sessao('lider', null), alvo('repositor', null))).toBe(false);
  });

  it('gerente libera repositores e líderes de qualquer setor, mas não gerentes', () => {
    expect(podeGerir(sessao('gerente', null), alvo('repositor', 'Padaria'))).toBe(true);
    expect(podeGerir(sessao('gerente', null), alvo('lider', 'Açougue'))).toBe(true);
    expect(podeGerir(sessao('gerente', null), alvo('gerente'))).toBe(false);
  });

  it('ninguém libera outra loja nem a si mesmo', () => {
    expect(podeGerir(sessao('admin'), alvo('repositor', 'Mercearia', 'L2'))).toBe(false);
    expect(podeGerir(sessao('admin'), { ...alvo('repositor'), matricula: '001000' })).toBe(false);
  });

  it('repositor não libera ninguém', () => {
    expect(podeGerir(sessao('repositor'), alvo('repositor'))).toBe(false);
  });
});
