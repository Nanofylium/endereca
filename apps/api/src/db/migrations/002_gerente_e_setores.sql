-- Gerente operacional: chefe dos líderes de todos os setores da loja (mercearia, padaria, açougue...).
ALTER TABLE colaboradores DROP CONSTRAINT colaboradores_papel_check;
ALTER TABLE colaboradores ADD CONSTRAINT colaboradores_papel_check CHECK (papel IN ('repositor', 'lider', 'gerente', 'admin'));

-- Setor de trabalho informado pelo RH. O líder enxerga só a equipe do próprio setor.
ALTER TABLE colaboradores ADD COLUMN setor TEXT;

-- Último acesso com sucesso, para o painel mostrar quem está usando o app.
CREATE INDEX tentativas_acesso_sucesso ON tentativas_acesso (matricula, criado_em DESC) WHERE sucesso;

ALTER TABLE aparelhos ADD COLUMN bloqueado_por TEXT;
ALTER TABLE aparelhos ADD COLUMN bloqueado_em TIMESTAMPTZ;
