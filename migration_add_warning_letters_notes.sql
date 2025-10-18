-- Adds a notes column to warning_letters for verbal recalls
ALTER TABLE warning_letters
  ADD COLUMN IF NOT EXISTS notes TEXT;
