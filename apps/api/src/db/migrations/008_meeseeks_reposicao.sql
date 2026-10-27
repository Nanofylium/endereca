-- Meeseeks de reposição: cada gôndola tem mínimo e máximo. Abaixo do mínimo, a tarefa de repor nasce sozinha,
-- já com a caixa que vence antes; quando a gôndola volta ao mínimo, ela se encerra sozinha.
ALTER TABLE enderecos_produto ADD COLUMN minimo INTEGER CHECK (minimo >= 0);
ALTER TABLE enderecos_produto ADD COLUMN maximo INTEGER CHECK (maximo > 0);
ALTER TABLE enderecos_produto ADD CONSTRAINT enderecos_produto_min_max CHECK (minimo IS NULL OR maximo IS NULL OR maximo > minimo);

ALTER TABLE tarefas DROP CONSTRAINT tarefas_tipo_check;
ALTER TABLE tarefas ADD CONSTRAINT tarefas_tipo_check CHECK (tipo IN ('boa_do_dia', 'reposicao'));
ALTER TABLE tarefas DROP CONSTRAINT tarefas_situacao_check;
ALTER TABLE tarefas ADD CONSTRAINT tarefas_situacao_check
  CHECK (situacao IN ('aguardando_lider', 'aberta', 'atribuida', 'concluida', 'sem_produto'));
-- Quantas unidades levar para a gôndola e de qual caixa tirar.
ALTER TABLE tarefas ADD COLUMN quantidade INTEGER;
ALTER TABLE tarefas ADD COLUMN caixa TEXT;

-- No máximo uma reposição em aberto por produto.
CREATE UNIQUE INDEX tarefas_reposicao_aberta ON tarefas (loja_id, sku) WHERE tipo = 'reposicao' AND situacao IN ('aberta', 'atribuida');
