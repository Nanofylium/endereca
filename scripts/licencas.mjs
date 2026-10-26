#!/usr/bin/env node
// Confere as licenças das dependências de produção de um app e, com --avisos,
// gera o arquivo de avisos de terceiros (copyright, LICENSE e NOTICE) que vai junto do build.
//
//   node scripts/licencas.mjs apps/mobile
//   node scripts/licencas.mjs apps/painel --avisos apps/painel/dist/AVISOS_DE_TERCEIROS.txt
//
// Só passa o que permite uso comercial em software fechado. GPL, AGPL, LGPL, SSPL e
// pacotes sem licença declarada falham até alguém revisar e anotar em REVISADAS.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PERMITIDAS = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'Unlicense', 'CC0-1.0',
  'BlueOak-1.0.0', 'Python-2.0', 'Zlib',
  // Atribuição de dados (caniuse-lite, usado só no build).
  'CC-BY-4.0',
  // Copyleft por arquivo: pode ser usada sem abrir o nosso código, desde que os arquivos
  // dela não sejam alterados (lightningcss, usado só no build).
  'MPL-2.0',
]);

// Pacotes cujo package.json não declara a licença no formato SPDX. Conferidos à mão no LICENSE.
const REVISADAS = {
  busboy: 'MIT',
  streamsearch: 'MIT',
  '@segment/loosely-validate-event': 'MIT',
  'qrcode-terminal': 'Apache-2.0',
  requireg: 'MIT',
  readline: 'BSD-3-Clause',
};

const [, , pastaApp, ...resto] = process.argv;
if (!pastaApp) {
  console.error('Uso: node scripts/licencas.mjs <pasta do app> [--avisos <arquivo>]');
  process.exit(2);
}
const raiz = resolve(pastaApp);
const iAvisos = resto.indexOf('--avisos');
const arquivoAvisos = iAvisos >= 0 ? resto[iAvisos + 1] : null;

const lock = JSON.parse(readFileSync(join(raiz, 'package-lock.json'), 'utf8'));

function nomeDoPacote(caminho) {
  return caminho.slice(caminho.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

function licencaPermitida(expressao) {
  const limpa = expressao.replace(/[()]/g, ' ').trim();
  // "A OR B": basta uma opção permitida. "A AND B": todas precisam ser.
  return limpa.split(/\s+OR\s+/).some((opcao) => opcao.split(/\s+AND\s+/).every((l) => PERMITIDAS.has(l.trim())));
}

const pacotes = [];
const recusados = [];
for (const [caminho, info] of Object.entries(lock.packages)) {
  if (!caminho || info.dev || info.link) continue;
  const nome = nomeDoPacote(caminho);
  const licenca = REVISADAS[nome] ?? (typeof info.license === 'string' ? info.license : null);
  if (!licenca || !licencaPermitida(licenca)) recusados.push(`${nome}@${info.version}: ${licenca ?? 'sem licença declarada'}`);
  pacotes.push({ nome, versao: info.version, licenca: licenca ?? '?', pasta: join(raiz, caminho) });
}

if (recusados.length) {
  console.error(`Licenças não aprovadas para uso comercial em código fechado (${recusados.length}):`);
  for (const r of recusados) console.error(`  - ${r}`);
  process.exit(1);
}
console.log(`${pacotes.length} dependências de produção com licença permitida.`);

if (arquivoAvisos) {
  const partes = [
    'Avisos de terceiros',
    '',
    'Este programa usa os componentes de código aberto abaixo. Os avisos de copyright e as',
    'licenças de cada um seguem como exigido por elas.',
    '',
  ];
  const vistos = new Set();
  for (const p of pacotes.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const chave = `${p.nome}@${p.versao}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    partes.push('-'.repeat(78), `${chave} (${p.licenca})`, '');
    if (!existsSync(p.pasta)) continue;
    const textos = readdirSync(p.pasta).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f));
    for (const f of textos) partes.push(readFileSync(join(p.pasta, f), 'utf8').trim(), '');
  }
  writeFileSync(arquivoAvisos, partes.join('\n'));
  console.log(`Avisos gravados em ${arquivoAvisos}.`);
}
