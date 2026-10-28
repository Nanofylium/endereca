# Instalar o app no celular do repositor (Android e iPhone)

O repositor instala o Endereça pela loja de aplicativos do celular, como qualquer outro app, e recebe as atualizações sozinho. Nenhum código-fonte sai do repositório: o que vai para a Google Play e para a Apple é o app compilado, com o JavaScript em bytecode Hermes e sem source maps, igual ao APK descrito em [distribuicao-e-protecao.md](distribuicao-e-protecao.md).

## Qual caminho usar

| | Piloto (agora) | Rede de lojas (depois) | Teste rápido |
| --- | --- | --- | --- |
| **Android** | Google Play, faixa de **teste interno**: até 100 pessoas, convidadas pelo e-mail Google. | **App privado** na Google Play gerenciada: só os aparelhos do Atacadão veem o app, instalado pelo MDM da loja. | **APK** baixado por link (workflow Distribuição). Precisa liberar "instalar apps desconhecidos" e não atualiza sozinho. |
| **iPhone** | **TestFlight**: o repositor instala o app TestFlight e entra pelo convite. Cada versão vale 90 dias. | **App personalizado** pelo Apple Business Manager do Atacadão: só a empresa vê o app, instalado pelo MDM ou por código de resgate. | **Ad hoc** (perfil `producao`): até 100 iPhones por ano, cada um cadastrado antes do build. |

O programa Apple Developer Enterprise não serve: a Apple só aceita a própria empresa distribuindo para os próprios funcionários, e o app seria do Atacadão, não do autor.

## Contas que só o Alexsandro pode abrir

Estas contas ficam no nome do dono do software. Nenhuma senha, chave ou arquivo dessas contas vai para o chat, para o repositório ou para o código: tudo fica guardado no EAS (Expo) ou nos segredos do GitHub.

| Conta | Custo | Para quê |
| --- | --- | --- |
| **Expo** (expo.dev) | Plano gratuito serve para começar. | Compila o app nos servidores do Expo (EAS), inclusive o de iPhone, sem precisar de Mac. |
| **Apple Developer Program** | US$ 99 por ano. | TestFlight, App Store e app personalizado. |
| **Google Play Console** | US$ 25, uma vez. | Teste interno e app privado na Google Play. |

Para a loja mostrar o nome de uma empresa em vez do nome pessoal, abra as contas da Apple e da Google como pessoa jurídica. Isso pede CNPJ e número D-U-N-S, que é gratuito mas pode levar alguns dias para sair.

## Configuração, uma vez só

Os comandos rodam em `apps/mobile`, com Node 22 instalado.

### 1. Expo

```bash
npx eas-cli login
npx eas-cli init          # cria o projeto e mostra o id dele (projectId)
```

O id do projeto não é segredo. Guarde-o na variável `EAS_PROJECT_ID`: no GitHub (Settings > Secrets and variables > Actions > Variables) e no terminal antes de rodar o EAS (`export EAS_PROJECT_ID=...`).

Cadastre o endereço da API no EAS, que é o que vai para dentro do app:

```bash
npx eas-cli env:create --name ENDERECA_API_URL --value https://api.seudominio.com.br --environment production --visibility plaintext
```

Em expo.dev > Account settings > Access tokens, crie um token e guarde no GitHub como o segredo `EXPO_TOKEN`.

### 2. iPhone (Apple)

1. Inscreva-se no Apple Developer Program e espere a aprovação.
2. Rode o primeiro build de iPhone no terminal, porque ele pede o login da Apple:
   ```bash
   npx eas-cli build --platform ios --profile loja
   ```
   O EAS cria o certificado e o perfil de distribuição e guarda os dois. Os builds seguintes rodam sem perguntar nada.
3. Envie para o TestFlight:
   ```bash
   npx eas-cli submit --platform ios --profile loja
   ```
   Na primeira vez ele cria o app no App Store Connect e oferece guardar uma chave de API da Apple no EAS. Aceite. Depois, copie o "Apple ID" numérico do app (App Store Connect > App > Informações do app) para `submit.loja.ios.ascAppId` no `eas.json`. Não é segredo, e o envio automático precisa dele.

### 3. Android (Google)

1. Crie a conta no Google Play Console e, nela, o app "Endereça" (gratuito, app).
2. Gere o primeiro pacote:
   ```bash
   npx eas-cli build --platform android --profile loja
   ```
   Baixe o `.aab` na página do build. A Google exige que o primeiro pacote seja enviado à mão: Play Console > Testar e lançar > Teste interno > Criar versão > enviar o `.aab`.
3. Para os envios seguintes serem automáticos, crie uma conta de serviço no Google Cloud com acesso ao Play Console, baixe a chave JSON e guarde no EAS: `npx eas-cli credentials` > Android > production > Google Service Account. Apague a cópia do computador depois.

## Publicar uma versão nova

GitHub > Actions > **Lojas** > Run workflow. Escolha os celulares (todos, só Android ou só iPhone) e deixe marcado "Enviar". O workflow confere as licenças e dispara o build no EAS. Em cerca de 30 minutos a versão aparece na faixa de teste interno da Google Play e no TestFlight. O número da versão sobe sozinho.

Sem GitHub, o mesmo pelo terminal:

```bash
npx eas-cli build --platform all --profile loja --auto-submit
```

## Como o repositor instala

**Android (teste interno).** No Play Console, em Teste interno > Testadores, adicione o e-mail Google do repositor e copie o link de participação. O repositor abre o link no celular, aceita e instala pela Google Play.

**iPhone (TestFlight).** Em App Store Connect > TestFlight, crie um grupo e adicione o repositor pelo e-mail ou ligue o link público. O repositor instala o app TestFlight da App Store, abre o convite e toca em Instalar. A Apple revisa a primeira versão de cada grupo externo antes de liberar, em geral em um ou dois dias.

**Depois de instalar, em qualquer celular:**

1. O repositor abre o app. O identificador do aparelho aparece no rodapé da tela de entrada.
2. A TI autoriza o aparelho na loja: `npm run cadastrar-aparelho -- <identificador> <loja> "<descrição>"` (em `apps/api`). A API recusa qualquer aparelho que não esteja autorizado.
3. O líder gera o código de primeiro acesso no painel, e o repositor entra com a matrícula, o código e cria a palavra secreta.

No iPhone, o identificador muda se o app for apagado e instalado de novo. Nesse caso o aparelho precisa ser autorizado outra vez.

## Antes de mandar para a revisão da Apple

A Apple testa o app antes de liberar o TestFlight para grupos externos e antes de aprovar o app personalizado. O revisor precisa de uma matrícula e de uma palavra secreta de teste, e o iPhone dele não vai estar na lista de aparelhos autorizados. Antes dessa etapa é preciso preparar uma loja de demonstração, com dados fictícios, onde a revisão consiga entrar. Até lá, use o TestFlight só com testadores internos (pessoas cadastradas na equipe do App Store Connect, até 100), que não passam por revisão.
