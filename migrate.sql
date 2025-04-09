-- Criar tabela de histórico de startups
CREATE TABLE IF NOT EXISTS "startup_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "startup_id" UUID NOT NULL REFERENCES "startups"("id"),
  "field_name" TEXT NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT NOT NULL,
  "changed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "changed_by" UUID REFERENCES "users"("id")
);

-- Criar tabela de histórico de status de startups
CREATE TABLE IF NOT EXISTS "startup_status_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "startup_id" UUID NOT NULL REFERENCES "startups"("id"),
  "status_id" UUID NOT NULL REFERENCES "statuses"("id"),
  "status_name" TEXT NOT NULL,
  "start_date" TIMESTAMP NOT NULL DEFAULT NOW(),
  "end_date" TIMESTAMP,
  "duration_minutes" INTEGER
);