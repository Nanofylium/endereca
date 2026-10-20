# Endereça

App interno para lojas de atacarejo: o repositor escaneia o QR Code ou o código de barras e descobre onde o produto está, na área de venda (endereços R-) e no estoque (depósito, caixaria, gaveta, intermédio, aéreo). O líder acompanha a equipe do seu setor e o gerente operacional acompanha a loja inteira.

O repositório tem a API (`apps/api`), o app do repositor para Android (`apps/mobile`) e o painel web do líder e do gerente (`apps/painel`).

## Como o acesso funciona

- **Matrícula só vem do RH.** A API não tem rota para criar matrícula. O sistema do RH envia o cadastro para `POST /rh/sincronizar`, autenticado pela chave `RH_API_KEY`.
- **Primeiro acesso com código do líder.** O líder gera um código de 6 caracteres (`POST /lider/codigos-ativacao`), de uso único, válido por 24 horas e preso àquela matrícula. O banco guarda só o HMAC do código.
- **Palavra secreta própria.** Na ativação o repositor cria uma palavra, como "chiclete": mínimo de 6 caracteres, com letras, sem conter nome nem matrícula. Guardada com scrypt.
- **Só aparelhos da loja.** Toda chamada envia `x-aparelho-id`, que precisa estar cadastrado e ativo na mesma loja da matrícula. O token fica preso ao aparelho.
- **Bloqueio.** Três tentativas erradas na mesma matrícula, ou cinco no mesmo aparelho, bloqueiam por 15 minutos e geram aviso para o líder.
- **Desligamento.** Quando o RH envia `ativo: false`, a matrícula é desativada, os códigos pendentes vencem e todas as sessões abertas caem.

## Papéis

O RH envia o papel e o setor de cada pessoa. O **líder** vê e libera só os repositores do próprio setor (Mercearia, Padaria, Bebidas...). O **gerente operacional** vê a loja inteira, libera líderes e repositores de qualquer setor e bloqueia aparelhos. Ninguém libera o próprio acesso, e uma mudança de papel no RH vale na chamada seguinte.

O primeiro gestor de uma loja nova recebe o código pela TI, direto no servidor: `npm run codigo-inicial -- <matricula>`.

## Rotas

| Rota | Quem usa |
| --- | --- |
| `POST /rh/sincronizar` | Sistema do RH (chave `x-rh-api-key`) |
| `POST /acesso/ativar` | Repositor no primeiro acesso |
| `POST /acesso/entrar` | Todos |
| `GET /lider/equipe` | Líder e gerente: equipe com situação de acesso |
| `GET /lider/pendentes` | Líder e gerente: quem veio do RH e ainda não ativou |
| `POST /lider/codigos-ativacao` | Líder e gerente: gera o código de primeiro acesso |
| `GET /lider/tentativas-recusadas` | Líder e gerente: tentativas recusadas do dia |
| `GET /lider/avisos` | Líder e gerente: bloqueios e outros avisos |
| `GET /lider/produtos-em-alerta` | Líder e gerente: produtos parados ou prestes a faltar |
| `GET /gerente/setores` | Gerente: resumo de cada setor |
| `GET /gerente/aparelhos` | Gerente: aparelhos da loja |
| `POST /gerente/aparelhos/:id/bloquear` e `/desbloquear` | Gerente: bloqueia um aparelho perdido e derruba as sessões dele |
| `POST /erp/produtos` | Sistema do catálogo (chave `x-erp-api-key`): importa e atualiza produtos pelo SKU e EAN |
| `POST /etiquetas/enderecos` | Líder e gerente: cria as etiquetas fixas de endereço |
| `GET /etiquetas/enderecos` | Líder e gerente: endereços etiquetados |
| `POST /etiquetas/volumes` | Recebimento: uma etiqueta para cada caixa ou palete |
| `GET /etiquetas/volumes/aguardando` | Volumes recebidos que ainda não foram guardados |
| `GET /etiquetas/ler/:codigo` | Diz o que foi bipado: endereço (com o que há nele), volume ou produto |
| `POST /etiquetas/guardar` | Bipou o volume e o endereço: registra onde o produto está |
| `POST /tarefas/boa-do-dia` | Gerente: envia a Boa do Dia para o setor |
| `GET /tarefas` | Líder e gerente: Boa do Dia do dia, com quem está e em que pé |
| `POST /tarefas/:id/atribuir` | Líder: escolhe quem da equipe vai preparar |
| `GET /tarefas/minhas` | Repositor: as tarefas passadas para ele |
| `POST /tarefas/:id/concluir` | Repositor: feito, ou sem produto |
| `POST /faltas` | Repositor: não tem o produto na gôndola para escanear |
| `GET /faltas` e `POST /faltas/:id/resolver` | Líder e gerente: faltas abertas |
| `GET /produtos?q=` | Busca por nome, marca, SKU ou EAN |
| `GET /produtos/ficha/:codigo` | Ficha completa a partir do QR (`ENDERECA:P:<sku>`), EAN ou SKU |

A ficha traz o endereço R- na área de venda, a quantidade na gôndola, os endereços de estoque, os dias sem venda, a apreciação do público (nota de 0 a 5), as vendas dos últimos 7 dias, a previsão de ruptura e o lote com validade e fornecedor.

## Etiquetas e cadastro dos itens

Ninguém cadastra produto à mão: o catálogo vem do ERP por `POST /erp/produtos`, pelo SKU e EAN que já estão na embalagem. O que a loja etiqueta são os lugares e os volumes:

- **Etiqueta de endereço** (`ENDERECA:L:<código>`): fixa em cada lugar (R-07 módulo 5 nível 3, Rua B 04, gaveta 14). O líder gera em lote no painel, com faixas como módulos 1-10 e níveis 1-4.
- **Etiqueta de volume** (`ENDERECA:V:<código>`): colada em cada caixa ou palete no recebimento, com produto, quantidade, lote e validade.
- **Endereçamento**: no app, o repositor bipa o volume e depois o endereço. O produto passa a constar ali com a quantidade do volume; se o volume já estava em outro lugar, a quantidade sai de lá.

O código impresso embaixo do QR usa só letras e números fáceis de ler (sem 0, O, 1, I e L), para digitar quando a etiqueta estiver danificada.

## Boa do Dia e produto em falta

O gerente operacional escolhe o produto da Boa do Dia e o setor. O líder do setor recebe o aviso no painel e escolhe quem da equipe vai preparar; a pessoa vê a tarefa na tela inicial do app, com o endereço da gôndola e onde buscar no estoque, e marca "Feito" ou "Sem produto".

Quando não há produto na gôndola para escanear, o repositor bipa a etiqueta do endereço na prateleira ou busca pelo nome e toca em "Não tem na gôndola" na ficha. Se houver estoque registrado, o app mostra onde buscar. Se não houver, o líder é avisado para pedir reposição. As faltas abertas ficam no painel, as sem estoque primeiro.

## Rodando localmente

Precisa de Node 22 e Docker.

```bash
docker compose up -d
cd apps/api
cp .env.example .env   # ajuste os segredos
npm install
export $(cat .env | xargs)
npm run migrate
npm run seed                      # dados de demonstração
npm run codigo-inicial -- 000100  # código da gerente de demonstração
npm run dev
```

O aparelho de demonstração é `APARELHO-DEMO-01`. Para autorizar um celular de verdade, pegue o identificador que aparece no rodapé da tela de login do app e rode `npm run cadastrar-aparelho -- <identificador> <loja> "<descrição>"`.

## App do repositor

Feito com Expo (React Native) para os celulares Android da loja. Telas: login com matrícula e palavra secreta, guardar caixa ou palete (bipa o volume e o endereço), o que está em um endereço, primeiro acesso com o código do líder, scanner de QR Code e código de barras (ou código digitado), busca por nome, marca, SKU ou EAN, e a ficha completa do produto. O token fica no armazenamento criptografado do aparelho e, se o RH desligar a pessoa ou a sessão cair, o app volta para o login.

```bash
cd apps/mobile
npm install
npm start          # abre o Expo; use o app Expo Go ou um emulador Android
```

O endereço da API fica em `app.json`, em `expo.extra.apiUrl` (o padrão `http://10.0.2.2:3000` é a API rodando no computador, vista do emulador Android). Como a API só aceita aparelhos autorizados, cadastre o identificador do celular ou emulador antes de entrar.

## Painel do líder e do gerente

Feito com Vite e React, abre no navegador do computador ou do tablet. O líder vê Equipe, Acessos (gerar código, tentativas recusadas, avisos), Produtos e avisos, e Etiquetas (gerar e imprimir etiquetas de endereço e de volume). O gerente vê também Setores e Aparelhos. Repositor não entra no painel.

```bash
cd apps/painel
cp .env.example .env   # VITE_API_URL, padrão http://localhost:3000
npm install
npm run dev            # http://localhost:5173
```

O navegador gera um identificador `WEB-...`, mostrado na tela de login. Cadastre-o com `npm run cadastrar-aparelho` na API e inclua a origem do painel em `ORIGENS_PAINEL`.

## Testes

O app e o painel rodam `npm test` e `npm run typecheck` nas suas pastas. Na API:

Os testes de ponta a ponta usam um PostgreSQL de verdade, apontado por `TEST_DATABASE_URL` (o padrão é `postgres://postgres@127.0.0.1:5433/endereca_test`). O banco de teste é apagado a cada execução.

```bash
cd apps/api
TEST_DATABASE_URL=postgres://endereca:endereca@localhost:5432/endereca_test npm test
```

## Especificação e protótipo

A especificação completa fica nos arquivos do projeto (`Especificacao_App_Atacadao_Repositores.md`). A seção 16 descreve o QR Code, a palavra secreta, o bloqueio de matrícula falsa e as ideias inspiradas na Alibaba.
