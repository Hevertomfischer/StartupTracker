-- Criar a tabela workflow_conditions se ela não existir
CREATE TABLE IF NOT EXISTS workflow_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Adicionar campo action_name na tabela workflow_actions
ALTER TABLE workflow_actions 
ADD COLUMN IF NOT EXISTS action_name TEXT NOT NULL DEFAULT 'Ação sem nome',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
