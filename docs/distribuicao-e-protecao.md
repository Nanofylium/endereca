# Distribuição e proteção do código

## O que a loja recebe

| Peça | O que é entregue | O que fica com o autor |
| --- | --- | --- |
| API (`apps/api`) | Nada. Roda no servidor do autor e a loja só acessa pela internet. | Todo o código, o banco e as chaves. |
| App do repositor (`apps/mobile`) | Um APK assinado, ou o app na Google Play e no TestFlight. | O código-fonte. |
| Painel (`apps/painel`) | Um instalador `.exe` para Windows, ou o endereço web do painel. | O código-fonte. |

Nenhum código-fonte é enviado ao Atacadão. O repositório no GitHub está privado.

## Como o build protege

**APK.** O JavaScript vai compilado para bytecode Hermes, não como texto. O código Java e Kotlin passa pelo R8, que minifica, troca os nomes e remove o que não é usado, e os recursos sem uso são cortados. O APK sai sem source maps, com backup pelo adb desligado (`allowBackup: false`) e recusando conexão sem https. O workflow confere o bytecode Hermes e a ausência de arquivos `.ts`, `.tsx` e `.map` antes de liberar o APK.

**Painel (.exe).** Feito com Tauri: o programa é Rust compilado com LTO e sem símbolos (`strip`), e o painel, já minificado e sem source maps, vai embutido e comprimido dentro do binário. A janela não expõe nenhum comando nativo e as ferramentas de desenvolvedor ficam desligadas no build de distribuição.

**Segredos.** Nada secreto vai para o app nem para o painel: só o endereço da API. As chaves (`JWT_SECRET`, `RH_API_KEY`, `ERP_API_KEY`) existem apenas no servidor. A keystore de assinatura do APK fica nos segredos do GitHub ou no EAS, nunca no repositório.

## O limite, sem exagero

Nenhum binário é impossível de descompilar. Com esforço, alguém consegue desmontar o bytecode Hermes e extrair o JavaScript minificado do `.exe`. O que essa pessoa obtém é a tela: nomes trocados, sem comentários, sem a estrutura do projeto, e sem nenhuma regra de negócio, porque o acesso por matrícula, o bloqueio, a ficha do produto, os indicadores e a licença de cada loja ficam na API.

A proteção de verdade vem de três coisas:

1. **O servidor.** A lógica e os dados ficam com o autor. Sem a API, o app e o painel não fazem nada. Uma chave de licença por loja, conferida pela API, permite cortar o acesso de quem não paga.
2. **O contrato.** Licença de uso, não venda do software. Cláusulas de propriedade intelectual do autor, proibição de engenharia reversa, cópia e sublicenciamento, e o que acontece com os dados quando o contrato acaba.
3. **O registro no INPI.** O registro de programa de computador (Lei 9.609/1998) é feito pela internet no e-Software do INPI. O código não fica público: o INPI guarda só o resumo criptográfico (hash) dele. Serve de prova de autoria e de data em caso de disputa.

Ofuscadores pesados de JavaScript existem, mas deixam o app mais lento e só atrasam quem já está decidido a copiar. Não foram usados.

Se o Atacadão exigir a API instalada no servidor dele, o código da API passa a estar na mão dele, mesmo compilado. Nesse caso a proteção é só o contrato e o registro, e o ideal é negociar para manter a API no servidor do autor.

## Gerar os builds

### Pelo GitHub (recomendado)

O workflow **Distribuição** (`.github/workflows/distribuicao.yml`) gera o APK e o instalador `.exe`. Rode pela aba Actions (Run workflow) e baixe os arquivos em Artifacts. Antes, configure em Settings > Secrets and variables > Actions:

- Variável `ENDERECA_API_URL`: o endereço https da API, como `https://api.seudominio.com.br`.
- Segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_SENHA`, `ANDROID_CHAVE_ALIAS` e `ANDROID_CHAVE_SENHA`.

Para criar a keystore, uma vez só:

```bash
keytool -genkeypair -v -keystore endereca.keystore -alias endereca -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 endereca.keystore   # o resultado vai no segredo ANDROID_KEYSTORE_BASE64
```

Guarde a keystore e as senhas fora do computador de trabalho também. Sem ela não dá para publicar atualização do app nos mesmos aparelhos.

Sem a keystore configurada, o workflow ainda gera o APK, assinado com a chave de depuração e marcado como `nao-assinado`, só para teste.

### Pelo EAS (Expo)

```bash
cd apps/mobile
npx eas-cli build --platform android --profile producao
```

O EAS guarda a keystore e entrega o APK. Defina `ENDERECA_API_URL` nas variáveis de ambiente do projeto no EAS.

Para a Google Play e o iPhone (TestFlight, App Store, Apple Business Manager) use o perfil `loja` e o workflow **Lojas**. O passo a passo, com as contas da Apple, da Google e do Expo, está em [instalar-no-celular.md](instalar-no-celular.md).

### No computador

```bash
# APK (precisa do Android SDK e do Java 17)
cd apps/mobile
ENDERECA_DISTRIBUICAO=1 ENDERECA_API_URL=https://api.seudominio.com.br npx expo prebuild -p android
cd android && ./gradlew assembleRelease

# .exe do painel (precisa do Rust; gere no Windows)
cd apps/painel
VITE_API_URL=https://api.seudominio.com.br npm run desktop:build
```

O build de distribuição do app falha de propósito se `ENDERECA_API_URL` não for https.

## Instalar na loja

- **APK:** instale pelo gerenciador de aparelhos da loja (MDM) ou manualmente. Depois cadastre o identificador do aparelho com `npm run cadastrar-aparelho`.
- **.exe:** o painel instalado conversa com a API pela origem `http://tauri.localhost`. Inclua essa origem em `ORIGENS_PAINEL` na API. Para o Windows não mostrar o aviso do SmartScreen, o instalador precisa ser assinado com um certificado de assinatura de código, comprado à parte.

## Licenças de terceiros

O CI roda `scripts/licencas.mjs` em cada app e falha se aparecer dependência com licença que não permite uso comercial fechado (GPL, AGPL, LGPL, SSPL ou sem licença). O workflow de distribuição gera `AVISOS_DE_TERCEIROS.txt` com os avisos de copyright e as licenças das dependências e coloca o arquivo dentro do APK e do `.exe`, como as licenças MIT, BSD e Apache exigem. As dependências Rust do `.exe` são conferidas pelo `cargo about` com a lista de `apps/painel/src-tauri/about.toml`.

A pesquisa de projetos abertos que podem entrar no Endereça está em [projetos-abertos.md](projetos-abertos.md).
