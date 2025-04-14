-- Criar tabela de arquivos
CREATE TABLE IF NOT EXISTS "files" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "filename" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mimetype" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Adicionar campo pitch_deck_id à tabela startups
ALTER TABLE "startups" 
ADD COLUMN IF NOT EXISTS "pitch_deck_id" UUID REFERENCES "files"("id") ON DELETE SET NULL;

-- Criar tabela de anexos de startups
CREATE TABLE IF NOT EXISTS "startup_attachments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "startup_id" UUID NOT NULL REFERENCES "startups"("id") ON DELETE CASCADE,
  "file_id" UUID NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "description" TEXT,
  "document_type" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);