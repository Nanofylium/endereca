import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Completa o app.json na hora do build.
 *
 * No build de distribuição (ENDERECA_DISTRIBUICAO=1, ligado pelo eas.json e pelo
 * workflow do APK) o endereço da API vem de ENDERECA_API_URL e precisa ser https,
 * o Android recusa tráfego sem criptografia e o R8 minifica e remove o que não é usado.
 * Nenhum segredo entra aqui: tudo o que vai no app.json acaba dentro do APK.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const distribuicao = process.env.ENDERECA_DISTRIBUICAO === '1';
  const apiUrl = process.env.ENDERECA_API_URL ?? config.extra?.apiUrl;

  if (distribuicao && !/^https:\/\//.test(apiUrl ?? '')) {
    throw new Error('No build de distribuição, ENDERECA_API_URL precisa ser um endereço https.');
  }

  return {
    ...(config as ExpoConfig),
    extra: { ...config.extra, apiUrl },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            usesCleartextTraffic: !distribuicao,
          },
        },
      ],
    ],
  };
};
