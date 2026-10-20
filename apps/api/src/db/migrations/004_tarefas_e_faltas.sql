-- Boa do Dia: o gerente operacional escolhe o produto, o líder do setor decide quem faz.
CREATE TABLE tarefas (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('boa_do_dia')),
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  setor           TEXT NOT NULL,
  dia             DATE NOT NULL,
  instrucoes      TEXT,
  criada_por      TEXT NOT NULL,
  criada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsavel     TEXT REFERENCES colaboradores(matricula),
  atribuida_por   TEXT,
  atribuida_em    TIMESTAMPTZ,
  situacao        TEXT NOT NULL DEFAULT 'aguardando_lider'
                  CHECK (situacao IN ('aguardando_lider', 'atribuida', 'concluida', 'sem_produto')),
  concluida_em    TIMESTAMPTZ,
  observacao      TEXT
);
CREATE UNIQUE INDEX tarefas_boa_do_dia_unica ON tarefas (loja_id, dia, sku) WHERE tipo = 'boa_do_dia';
CREATE INDEX tarefas_responsavel ON tarefas (responsavel, situacao);

-- Produto que não está na gôndola para escanear. Guarda quanto havia no estoque no momento do aviso.
CREATE TABLE faltas (
  id              BIGSERIAL PRIMARY KEY,
  loja_id         TEXT NOT NULL REFERENCES lojas(id),
  sku             TEXT NOT NULL REFERENCES produtos(sku),
  reportado_por   TEXT NOT NULL,
  reportado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  estoque         INTEGER NOT NULL,
  observacao      TEXT,
  tarefa_id       BIGINT REFERENCES tarefas(id),
  resolvida_em    TIMESTAMPTZ,
  resolvida_por   TEXT
);
CREATE INDEX faltas_abertas ON faltas (loja_id, reportado_em DESC) WHERE resolvida_em IS NULL;
