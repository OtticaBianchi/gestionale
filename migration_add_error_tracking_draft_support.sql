-- Migration: add draft support to error_tracking table

ALTER TABLE error_tracking
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_created_from_order UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'error_tracking_auto_created_from_order_fkey'
      AND conrelid = 'error_tracking'::regclass
  ) THEN
    ALTER TABLE error_tracking
      ADD CONSTRAINT error_tracking_auto_created_from_order_fkey
      FOREIGN KEY (auto_created_from_order)
      REFERENCES ordini_materiali(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS error_tracking_draft_idx
  ON error_tracking (is_draft, auto_created_from_order);
