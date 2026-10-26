-- Caixa ou palete que acabou: o repositor bipa a etiqueta e dá baixa, e a quantidade sai do endereço.
ALTER TABLE volumes ADD COLUMN baixado_em TIMESTAMPTZ;
ALTER TABLE volumes ADD COLUMN baixado_por TEXT;

-- Caixas guardadas de um produto, para a ficha mostrar onde estão (a de validade mais próxima primeiro).
CREATE INDEX volumes_guardados ON volumes (loja_id, sku) WHERE local_id IS NOT NULL AND baixado_em IS NULL;
DROP INDEX volumes_aguardando;
CREATE INDEX volumes_aguardando ON volumes (loja_id, recebido_em DESC) WHERE local_id IS NULL AND baixado_em IS NULL;
