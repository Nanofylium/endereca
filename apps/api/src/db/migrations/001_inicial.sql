-- Estrutura inicial do Endereça.
-- Matrículas só entram por colaboradores, que é alimentada exclusivamente pela integração com o RH.

CREATE TABLE lojas (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL
);

CREATE TABLE colaboradores (
  matricula       TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  papel           TEXT NOT NULL CHECK (papel IN ('repositor', 'lider', 'admin')),
  ativo_no_rh     BOOLEAN NOT NULL DEFAULT TRUE,
  palavra_hash    TEXT,
  ativado_em      TIMESTAMPTZ,
  versao_token    INTEGER NOT NULL DEFAULT 0,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aparelhos (
  id              TEXT PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  descricao       TEXT NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE codigos_ativacao (
  id              BIGSERIAL PRIMARY KEY,
  matricula       TEXT NOT NULL REFERENCES colaboradores(matricula),
  codigo_hash     TEXT NOT NULL,
  gerado_por      TEXT NOT NULL, -- matrícula de quem gerou, ou "sistema" no primeiro acesso da loja
  expira_em       TIMESTAMPTZ NOT NULL,
  usado_em        TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX codigos_ativacao_matricula ON codigos_ativacao (matricula);

-- Toda tentativa de ativar ou entrar, com sucesso ou não. Serve para bloqueio e para o painel do líder.
CREATE TABLE tentativas_acesso (
  id              BIGSERIAL PRIMARY KEY,
  matricula       TEXT NOT NULL,
  loja_id         TEXT,
  aparelho_id     TEXT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('ativacao', 'login')),
  sucesso         BOOLEAN NOT NULL,
  motivo          TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tentativas_acesso_matricula ON tentativas_acesso (matricula, criado_em DESC);
CREATE INDEX tentativas_acesso_aparelho ON tentativas_acesso (aparelho_id, criado_em DESC);

CREATE TABLE avisos_lider (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  tipo            TEXT NOT NULL,
  texto           TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auditoria (
  id              BIGSERIAL PRIMARY KEY,
  autor           TEXT NOT NULL,
  acao            TEXT NOT NULL,
  loja_id         TEXT,
  aparelho_id     TEXT,
  detalhes        JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE produtos (
  sku             TEXT PRIMARY KEY,
  ean             TEXT UNIQUE,
  nome            TEXT NOT NULL,
  marca           TEXT,
  departamento    TEXT NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

-- Endereços por loja. tipo 'venda' usa o padrão R- da área de venda; os demais são de estoque.
CREATE TABLE enderecos_produto (
  id              BIGSERIAL PRIMARY KEY,
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('venda', 'deposito', 'caixaria', 'gaveta', 'intermedio', 'aereo')),
  rua             TEXT NOT NULL,
  modulo          TEXT,
  nivel           TEXT,
  posicao         TEXT,
  quantidade      INTEGER,
  principal       BOOLEAN NOT NULL DEFAULT FALSE,
  confirmado_em   TIMESTAMPTZ,
  confirmado_por  TEXT REFERENCES colaboradores(matricula)
);
CREATE INDEX enderecos_produto_sku_loja ON enderecos_produto (sku, loja_id);

-- Vendas diárias por loja, base para dias sem venda, apreciação e previsão de ruptura.
CREATE TABLE vendas_diarias (
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  dia             DATE NOT NULL,
  unidades        INTEGER NOT NULL,
  PRIMARY KEY (sku, loja_id, dia)
);

CREATE TABLE lotes_produto (
  id              BIGSERIAL PRIMARY KEY,
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  lote            TEXT NOT NULL,
  validade        DATE,
  fornecedor      TEXT,
  proxima_entrega TIMESTAMPTZ
);

-- Nota de 0 a 5 combinando giro, recompra e avaliações, calculada fora da API.
CREATE TABLE apreciacao_produto (
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  nota            NUMERIC(2, 1) NOT NULL CHECK (nota >= 0 AND nota <= 5),
  calculado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sku, loja_id)
);
