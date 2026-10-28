-- Treinamento do repositor: lições com perguntas e prática de achar produto na loja de verdade.
-- Vale para quem ainda está no período de experiência e para quem já é da casa.
CREATE TABLE treino_licoes (
  matricula       TEXT NOT NULL REFERENCES colaboradores(matricula),
  licao           TEXT NOT NULL,
  acertos         INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  tentativas      INTEGER NOT NULL DEFAULT 1,
  concluida_em    TIMESTAMPTZ,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (matricula, licao)
);

-- Desafio "ache o produto": o app mostra um produto da loja e a pessoa diz onde ele fica.
CREATE TABLE treino_desafios (
  id              BIGSERIAL PRIMARY KEY,
  matricula       TEXT NOT NULL REFERENCES colaboradores(matricula),
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  acertou         BOOLEAN NOT NULL,
  dia             DATE NOT NULL,
  respondido_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX treino_desafios_matricula ON treino_desafios (matricula, dia);
