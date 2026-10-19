# Endereça

App interno para lojas de atacarejo: o repositor escaneia o QR Code ou o código de barras e descobre onde o produto está, na área de venda (endereços R-) e no estoque (depósito, caixaria, gaveta, intermédio, aéreo). O líder acompanha a equipe e libera os acessos.

O repositório tem a API (`apps/api`) e o app do repositor para Android (`apps/mobile`). O painel do líder vem na próxima etapa.

## Como o acesso funciona

- **Matrícula só vem do RH.** A API não tem rota para criar matrícula. O sistema do RH envia o cadastro para `POST /rh/sincronizar`, autenticado pela chave `RH_API_KEY`.
- **Primeiro acesso com código do líder.** O líder gera um código de 6 caracteres (`POST /lider/codigos-ativacao`), de uso único, válido por 24 horas e preso àquela matrícula. O banco guarda só o HMAC do código.
- **Palavra secreta própria.** Na ativação o repositor cria uma palavra, como "chiclete": mínimo de 6 caracteres, com letras, sem conter nome nem matrícula. Guardada com scrypt.
- **Só aparelhos da loja.** Toda chamada envia `x-aparelho-id`, que precisa estar cadastrado e ativo na mesma loja da matrícula. O token fica preso ao aparelho.
- **Bloqueio.** Três tentativas erradas na mesma matrícula, ou cinco no mesmo aparelho, bloqueiam por 15 minutos e geram aviso para o líder.
- **Desligamento.** Quando o RH envia `ativo: false`, a matrícula é desativada, os códigos pendentes vencem e todas as sessões abertas caem.

O primeiro líder de uma loja nova recebe o código pela TI, direto no servidor: `npm run codigo-inicial -- <matricula>`.

## Rotas

| Rota | Quem usa |
| --- | --- |
| `POST /rh/sincronizar` | Sistema do RH (chave `x-rh-api-key`) |
| `POST /acesso/ativar` | Repositor no primeiro acesso |
| `POST /acesso/entrar` | Repositor e líder |
| `GET /lider/pendentes` | Líder: quem veio do RH e ainda não ativou |
| `POST /lider/codigos-ativacao` | Líder: gera o código de primeiro acesso |
| `GET /lider/tentativas-recusadas` | Líder: tentativas recusadas do dia |
| `GET /lider/avisos` | Líder: bloqueios e outros avisos |
| `GET /produtos?q=` | Busca por nome, marca, SKU ou EAN |
| `GET /produtos/ficha/:codigo` | Ficha completa a partir do QR (`ENDERECA:P:<sku>`), EAN ou SKU |

A ficha traz o endereço R- na área de venda, a quantidade na gôndola, os endereços de estoque, os dias sem venda, a apreciação do público (nota de 0 a 5), as vendas dos últimos 7 dias, a previsão de ruptura e o lote com validade e fornecedor.

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
npm run codigo-inicial -- 001000  # código do líder de demonstração
npm run dev
```

O aparelho de demonstração é `APARELHO-DEMO-01`. Para autorizar um celular de verdade, pegue o identificador que aparece no rodapé da tela de login do app e rode `npm run cadastrar-aparelho -- <identificador> <loja> "<descrição>"`.

## App do repositor

Feito com Expo (React Native) para os celulares Android da loja. Telas: login com matrícula e palavra secreta, primeiro acesso com o código do líder, scanner de QR Code e código de barras (ou código digitado), busca por nome, marca, SKU ou EAN, e a ficha completa do produto. O token fica no armazenamento criptografado do aparelho e, se o RH desligar a pessoa ou a sessão cair, o app volta para o login.

```bash
cd apps/mobile
npm install
npm start          # abre o Expo; use o app Expo Go ou um emulador Android
```

O endereço da API fica em `app.json`, em `expo.extra.apiUrl` (o padrão `http://10.0.2.2:3000` é a API rodando no computador, vista do emulador Android). Como a API só aceita aparelhos autorizados, cadastre o identificador do celular ou emulador antes de entrar.

## Testes

O app roda `npm test` e `npm run typecheck` em `apps/mobile`. Na API:

Os testes de ponta a ponta usam um PostgreSQL de verdade, apontado por `TEST_DATABASE_URL` (o padrão é `postgres://postgres@127.0.0.1:5433/endereca_test`). O banco de teste é apagado a cada execução.

```bash
cd apps/api
TEST_DATABASE_URL=postgres://endereca:endereca@localhost:5432/endereca_test npm test
```

## Especificação e protótipo

A especificação completa fica nos arquivos do projeto (`Especificacao_App_Atacadao_Repositores.md`). A seção 16 descreve o QR Code, a palavra secreta, o bloqueio de matrícula falsa e as ideias inspiradas na Alibaba.
