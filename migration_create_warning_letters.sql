-- Create warning_letters table to store error warning records
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS warning_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  letter_type TEXT NOT NULL CHECK (letter_type IN ('verbal', 'written', 'disciplinary')),
  pdf_data BYTEA,
  notes TEXT,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_errors INTEGER NOT NULL DEFAULT 0,
  critical_errors INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  weekly_errors INTEGER NOT NULL DEFAULT 0,
  monthly_errors INTEGER NOT NULL DEFAULT 0,
  sent_via_email BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT
);

CREATE INDEX IF NOT EXISTS warning_letters_employee_idx
  ON warning_letters (employee_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS warning_letters_generated_at_idx
  ON warning_letters (generated_at DESC);
