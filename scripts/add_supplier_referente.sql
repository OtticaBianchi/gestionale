-- Add referente_nome to each supplier table (idempotent)

ALTER TABLE IF EXISTS fornitori_lenti
  ADD COLUMN IF NOT EXISTS referente_nome TEXT;

ALTER TABLE IF EXISTS fornitori_montature
  ADD COLUMN IF NOT EXISTS referente_nome TEXT;

ALTER TABLE IF EXISTS fornitori_lac
  ADD COLUMN IF NOT EXISTS referente_nome TEXT;

ALTER TABLE IF EXISTS fornitori_sport
  ADD COLUMN IF NOT EXISTS referente_nome TEXT;

ALTER TABLE IF EXISTS fornitori_lab_esterno
  ADD COLUMN IF NOT EXISTS referente_nome TEXT;

-- Optional: touch updated_at where available
-- UPDATE tables will set updated_at from app code when editing suppliers.
