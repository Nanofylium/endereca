/**
 * Coloca AVISOS_DE_TERCEIROS.txt dentro do app no prebuild do build de distribuição,
 * no Android (assets) e no iPhone (recurso do pacote). Assim os builds do EAS levam os
 * avisos de licença como o APK do workflow do GitHub.
 */
const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const ARQUIVO = 'AVISOS_DE_TERCEIROS.txt';

function gerar(raizApp, destino) {
  execFileSync(process.execPath, [join(raizApp, '../../scripts/licencas.mjs'), raizApp, '--avisos', destino], { stdio: 'inherit' });
}

module.exports = function avisosDeTerceiros(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const pasta = join(cfg.modRequest.platformProjectRoot, 'app/src/main/assets');
      mkdirSync(pasta, { recursive: true });
      gerar(cfg.modRequest.projectRoot, join(pasta, ARQUIVO));
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const nome = cfg.modRequest.projectName;
    gerar(cfg.modRequest.projectRoot, join(cfg.modRequest.platformProjectRoot, nome, ARQUIVO));
    cfg.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: join(nome, ARQUIVO),
      groupName: nome,
      project: cfg.modResults,
      isBuildFile: true,
      verbose: false,
    });
    return cfg;
  });

  return config;
};
