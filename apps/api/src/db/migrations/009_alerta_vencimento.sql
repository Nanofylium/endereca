-- O que o líder decidiu fazer com um lote perto de vencer. O alerta continua aparecendo, marcado como tratado.
CREATE TABLE acoes_vencimento (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  lote            TEXT NOT NULL DEFAULT '',
  validade        DATE NOT NULL,
  acao            TEXT NOT NULL CHECK (acao IN ('destacar', 'rebaixar', 'devolver', 'retirar')),
  observacao      TEXT,
  decidido_por    TEXT NOT NULL REFERENCES colaboradores(matricula),
  decidido_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX acoes_vencimento_lote ON acoes_vencimento (loja_id, sku, lote, validade, decidido_em DESC);

-- Caixas com validade, para o alerta achar rápido o que vence primeiro.
CREATE INDEX volumes_validade ON volumes (loja_id, validade) WHERE baixado_em IS NULL AND validade IS NOT NULL;
