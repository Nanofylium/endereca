import { conferirCodigo, gerarCodigoAtivacao, hashCodigo, TAMANHO_CODIGO } from './codigo-ativacao';
import { conferirPalavra, gerarHashPalavra, validarPalavraSecreta } from './palavra-secreta';

const dono = { matricula: '004512', nome: 'Carla Mendes' };

describe('palavra secreta', () => {
  it('aceita uma palavra comum como "chiclete"', () => {
    expect(validarPalavraSecreta('chiclete', dono)).toBeNull();
  });

  it.each([
    ['curta', 'pelo menos 6'],
    ['123456789', 'não apenas números'],
    ['atacadao', 'fácil de adivinhar'],
    ['carla2024', 'seu nome'],
    ['abc004512', 'sua matrícula'],
  ])('recusa "%s"', (palavra, trecho) => {
    expect(validarPalavraSecreta(palavra, dono)).toContain(trecho);
  });

  it('confere o hash sem diferenciar maiúsculas e espaços nas pontas', async () => {
    const hash = await gerarHashPalavra('Chiclete');
    expect(hash).not.toContain('hiclete');
    await expect(conferirPalavra('  chiclete ', hash)).resolves.toBe(true);
    await expect(conferirPalavra('chicletes', hash)).resolves.toBe(false);
  });

  it('gera hashes diferentes para a mesma palavra', async () => {
    expect(await gerarHashPalavra('chiclete')).not.toBe(await gerarHashPalavra('chiclete'));
  });
});

describe('código de ativação', () => {
  it('gera códigos legíveis, sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const codigo = gerarCodigoAtivacao();
      expect(codigo).toHaveLength(TAMANHO_CODIGO);
      expect(codigo).not.toMatch(/[01OIL]/);
    }
  });

  it('só confere com a mesma matrícula', () => {
    const hash = hashCodigo('K7M2QX', '007001', 'segredo');
    expect(conferirCodigo('k7m-2qx', '007001', 'segredo', hash)).toBe(true);
    expect(conferirCodigo('K7M2QX', '007002', 'segredo', hash)).toBe(false);
    expect(conferirCodigo('K7M2QX', '007001', 'outro', hash)).toBe(false);
  });
});
