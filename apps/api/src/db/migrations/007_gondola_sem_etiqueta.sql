-- Gôndola sem etiqueta de prateleira: o Endereça guarda o que vai em cada módulo e nível,
-- e o preço chega ao cliente pelo terminal de consulta, não pelo papel na prateleira.

-- Preço de atacado (a partir de N unidades), que hoje vai impresso na etiqueta da prateleira.
ALTER TABLE produto_loja ADD COLUMN preco_atacado NUMERIC(10, 2);
ALTER TABLE produto_loja ADD COLUMN quantidade_atacado INTEGER CHECK (quantidade_atacado > 1);

-- Leitores de preço para o cliente, espalhados pela área de venda. Só o hash da chave fica no banco.
CREATE TABLE terminais_consulta (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  descricao       TEXT NOT NULL,
  rua             TEXT,
  chave_hash      TEXT NOT NULL UNIQUE,
  criado_por      TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revogado_em     TIMESTAMPTZ
);

CREATE INDEX enderecos_venda_modulo ON enderecos_produto (loja_id, rua, modulo) WHERE tipo = 'venda';
