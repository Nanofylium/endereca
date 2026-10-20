import { NovoLocal, TipoLocal } from './tipos';

/** Faixa digitada como "1-4", "1,3,5" ou "07". Mantém zeros à esquerda ("01-03" vira 01, 02, 03). */
export function expandirFaixa(texto: string): string[] {
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean);
  const valores: string[] = [];
  for (const parte of partes) {
    const faixa = /^(\d+)\s*-\s*(\d+)$/.exec(parte);
    if (!faixa) {
      valores.push(parte);
      continue;
    }
    const [inicio, fim] = [Number(faixa[1]), Number(faixa[2])];
    if (fim < inicio || fim - inicio > 200) throw new Error(`Faixa inválida: ${parte}`);
    const largura = faixa[1].length;
    for (let n = inicio; n <= fim; n++) valores.push(String(n).padStart(largura, '0'));
  }
  return [...new Set(valores)];
}

/** Uma etiqueta para cada combinação de módulo, nível e posição. Campos vazios ficam de fora. */
export function montarLocais(tipo: TipoLocal, rua: string, modulos: string, niveis: string, posicoes: string): NovoLocal[] {
  const lista = (t: string) => (t.trim() ? expandirFaixa(t) : [undefined]);
  const locais: NovoLocal[] = [];
  for (const modulo of lista(modulos))
    for (const nivel of lista(niveis))
      for (const posicao of lista(posicoes)) locais.push({ tipo, rua: rua.trim(), modulo, nivel, posicao });
  if (locais.length > 500) throw new Error('São mais de 500 etiquetas de uma vez. Divida em partes menores.');
  return locais;
}
