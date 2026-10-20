-- Etiquetas com QR Code: uma fixa em cada endereço da loja e uma em cada caixa ou palete recebido.

-- Cada lugar físico da loja (R-07 módulo 5 nível 3, Rua B 04, gaveta 14...). O QR da etiqueta guarda só o código.
CREATE TABLE locais (
  id              BIGSERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL UNIQUE,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('venda', 'deposito', 'caixaria', 'gaveta', 'intermedio', 'aereo')),
  rua             TEXT NOT NULL,
  modulo          TEXT,
  nivel           TEXT,
  posicao         TEXT,
  criado_por      TEXT NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX locais_unico ON locais (loja_id, tipo, rua, COALESCE(modulo, ''), COALESCE(nivel, ''), COALESCE(posicao, ''));

-- Caixa ou palete etiquetado no recebimento. Fica "aguardando" até alguém bipar o volume e o endereço onde o guardou.
CREATE TABLE volumes (
  id              BIGSERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL UNIQUE,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  lote            TEXT,
  validade        DATE,
  recebido_por    TEXT NOT NULL,
  recebido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_id        BIGINT REFERENCES locais(id),
  guardado_por    TEXT,
  guardado_em     TIMESTAMPTZ
);
CREATE INDEX volumes_aguardando ON volumes (loja_id, recebido_em DESC) WHERE local_id IS NULL;
