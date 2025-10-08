-- Migration: Remove materiali_parzialmente_arrivati state
-- Date: 2025-10-08
-- Description: Simplify workflow from 7 states to 6 states by removing materiali_parzialmente_arrivati

-- IMPORTANT: Run this in Supabase SQL Editor
-- Make sure you're connected to the correct database

-- First, let's check if there are any buste with the old state
-- SELECT COUNT(*) FROM buste WHERE stato_attuale = 'materiali_parzialmente_arrivati';

-- Step 1: Move any existing buste from materiali_parzialmente_arrivati to materiali_arrivati
UPDATE buste
SET stato_attuale = 'materiali_arrivati',
    updated_at = NOW()
WHERE stato_attuale = 'materiali_parzialmente_arrivati';

-- Step 2: Update any status_history records (for historical data integrity)
UPDATE status_history
SET stato = 'materiali_arrivati'
WHERE stato = 'materiali_parzialmente_arrivati';

-- Step 3: Remove default values before changing enum
ALTER TABLE buste
  ALTER COLUMN stato_attuale DROP DEFAULT;

ALTER TABLE status_history
  ALTER COLUMN stato DROP DEFAULT;

-- Step 4: Create new enum without the partial state
CREATE TYPE job_status_new AS ENUM (
  'nuove',
  'materiali_ordinati',
  'materiali_arrivati',
  'in_lavorazione',
  'pronto_ritiro',
  'consegnato_pagato'
);

-- Step 5: Alter tables to use new enum
ALTER TABLE buste
  ALTER COLUMN stato_attuale TYPE job_status_new
  USING stato_attuale::text::job_status_new;

ALTER TABLE status_history
  ALTER COLUMN stato TYPE job_status_new
  USING stato::text::job_status_new;

-- Step 6: Restore default values with new enum
ALTER TABLE buste
  ALTER COLUMN stato_attuale SET DEFAULT 'nuove'::job_status_new;

-- Step 7: Drop old enum and rename new one
DROP TYPE job_status;
ALTER TYPE job_status_new RENAME TO job_status;

-- Verification queries (run these after to verify):
-- SELECT stato_attuale, COUNT(*) FROM buste GROUP BY stato_attuale ORDER BY stato_attuale;
-- SELECT stato, COUNT(*) FROM status_history GROUP BY stato ORDER BY stato;
