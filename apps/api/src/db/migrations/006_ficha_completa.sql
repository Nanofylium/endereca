-- Cadastro que o ERP manda junto com o produto e que aparece na ficha ao bipar.
ALTER TABLE produtos ADD COLUMN codigo_interno TEXT;
ALTER TABLE produtos ADD COLUMN classe TEXT;
ALTER TABLE produtos ADD COLUMN setor_save TEXT;
ALTER TABLE produtos ADD COLUMN unidades_embalagem INTEGER CHECK (unidades_embalagem > 0);
-- Paletização: lastro = caixas por camada, altura = camadas por palete.
ALTER TABLE produtos ADD COLUMN lastro INTEGER CHECK (lastro > 0);
ALTER TABLE produtos ADD COLUMN altura INTEGER CHECK (altura > 0);
ALTER TABLE produtos ADD COLUMN vida_util_dias INTEGER CHECK (vida_util_dias > 0);

-- Preço e última compra mudam de loja para loja.
CREATE TABLE produto_loja (
  sku                       TEXT NOT NULL REFERENCES produtos(sku),
  loja_id                   TEXT NOT NULL REFERENCES lojas(id),
  preco_unidade             NUMERIC(10, 2),
  preco_embalagem           NUMERIC(10, 2),
  ultima_compra_em          DATE,
  ultima_compra_quantidade  INTEGER,
  atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sku, loja_id)
);

-- Conjuntos (kits, fardos mistos, combos) de que o produto faz parte.
CREATE TABLE conjuntos_produto (
  codigo          TEXT NOT NULL,
  nome            TEXT NOT NULL,
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  PRIMARY KEY (codigo, sku)
);
CREATE INDEX conjuntos_produto_sku ON conjuntos_produto (sku);

-- Cada vez que alguém bipa o produto, para a ficha mostrar a leitura anterior e quantas houve no dia.
CREATE TABLE leituras_produto (
  id              BIGSERIAL PRIMARY KEY,
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  matricula       TEXT NOT NULL,
  forma           TEXT NOT NULL CHECK (forma IN ('qr', 'ean', 'sku')),
  lido_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leituras_produto_sku_loja ON leituras_produto (loja_id, sku, lido_em DESC);
