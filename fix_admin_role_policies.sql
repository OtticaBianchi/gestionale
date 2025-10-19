-- Fix RLS policies to use 'admin' instead of 'amministratore'
-- Run this in Supabase SQL Editor

-- Drop old policies
DROP POLICY IF EXISTS "Only admins can update unpredicted cases" ON unpredicted_cases;
DROP POLICY IF EXISTS "Only admins can delete unpredicted cases" ON unpredicted_cases;
DROP POLICY IF EXISTS "Only admins can update procedure suggestions" ON procedure_suggestions;
DROP POLICY IF EXISTS "Only admins can delete procedure suggestions" ON procedure_suggestions;

-- Recreate with correct role check
CREATE POLICY "Only admins can update unpredicted cases"
  ON unpredicted_cases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete unpredicted cases"
  ON unpredicted_cases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update procedure suggestions"
  ON procedure_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete procedure suggestions"
  ON procedure_suggestions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
