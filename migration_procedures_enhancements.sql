-- Procedures Enhancement Migration
-- Adds support for:
-- 1. Casi NON Previsti (Unpredicted Cases)
-- 2. Procedure Suggestions (Proposta Modifiche)
-- 3. Procedure Helpfulness Voting (Ti è stata utile?)

-- =============================================
-- 1. UNPREDICTED CASES TABLE
-- =============================================

CREATE TABLE unpredicted_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  context_category TEXT CHECK (context_category IN (
    'accoglienza', 'vendita', 'appuntamenti', 'sala_controllo',
    'lavorazioni', 'consegna', 'customer_care', 'amministrazione', 'it',
    'sport', 'straordinarie'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('bassa', 'media', 'alta', 'urgente')),

  -- Who reported it
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Admin resolution
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Optional: if converted to a procedure
  related_procedure_id UUID REFERENCES procedures(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_unpredicted_cases_category ON unpredicted_cases(context_category);
CREATE INDEX idx_unpredicted_cases_severity ON unpredicted_cases(severity);
CREATE INDEX idx_unpredicted_cases_created_by ON unpredicted_cases(created_by);
CREATE INDEX idx_unpredicted_cases_completed ON unpredicted_cases(is_completed) WHERE is_completed = false;
CREATE INDEX idx_unpredicted_cases_created_at ON unpredicted_cases(created_at DESC);

-- =============================================
-- 2. PROCEDURE SUGGESTIONS TABLE
-- =============================================

CREATE TABLE procedure_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Who suggested it
  suggested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Admin review
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
  admin_notes TEXT,
  handled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  handled_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_procedure_suggestions_procedure_id ON procedure_suggestions(procedure_id);
CREATE INDEX idx_procedure_suggestions_status ON procedure_suggestions(status);
CREATE INDEX idx_procedure_suggestions_suggested_by ON procedure_suggestions(suggested_by);
CREATE INDEX idx_procedure_suggestions_created_at ON procedure_suggestions(created_at DESC);

-- =============================================
-- 3. PROCEDURE HELPFULNESS VOTES TABLE
-- =============================================

CREATE TABLE procedure_helpfulness_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),

  -- One vote per user per procedure
  UNIQUE(procedure_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_helpfulness_votes_procedure_id ON procedure_helpfulness_votes(procedure_id);
CREATE INDEX idx_helpfulness_votes_user_id ON procedure_helpfulness_votes(user_id);

-- =============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE unpredicted_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_helpfulness_votes ENABLE ROW LEVEL SECURITY;

-- Unpredicted Cases Policies
-- Everyone can read all cases
CREATE POLICY "Everyone can view unpredicted cases"
  ON unpredicted_cases FOR SELECT
  USING (true);

-- Everyone can insert cases
CREATE POLICY "Everyone can create unpredicted cases"
  ON unpredicted_cases FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only admins can update/complete cases
CREATE POLICY "Only admins can update unpredicted cases"
  ON unpredicted_cases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete cases
CREATE POLICY "Only admins can delete unpredicted cases"
  ON unpredicted_cases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Procedure Suggestions Policies
-- Everyone can read suggestions
CREATE POLICY "Everyone can view procedure suggestions"
  ON procedure_suggestions FOR SELECT
  USING (true);

-- Everyone can create suggestions
CREATE POLICY "Everyone can create procedure suggestions"
  ON procedure_suggestions FOR INSERT
  WITH CHECK (auth.uid() = suggested_by);

-- Only admins can update suggestions
CREATE POLICY "Only admins can update procedure suggestions"
  ON procedure_suggestions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete suggestions
CREATE POLICY "Only admins can delete procedure suggestions"
  ON procedure_suggestions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Helpfulness Votes Policies
-- Everyone can read votes
CREATE POLICY "Everyone can view helpfulness votes"
  ON procedure_helpfulness_votes FOR SELECT
  USING (true);

-- Users can insert their own votes
CREATE POLICY "Users can create their own votes"
  ON procedure_helpfulness_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON procedure_helpfulness_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON procedure_helpfulness_votes FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Function to get unpredicted cases count by category
CREATE OR REPLACE FUNCTION get_unpredicted_cases_stats()
RETURNS TABLE (
  category TEXT,
  total_count BIGINT,
  pending_count BIGINT,
  completed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    context_category as category,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_completed = false) as pending_count,
    COUNT(*) FILTER (WHERE is_completed = true) as completed_count
  FROM unpredicted_cases
  WHERE context_category IS NOT NULL
  GROUP BY context_category
  ORDER BY pending_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get procedure helpfulness stats
CREATE OR REPLACE FUNCTION get_procedure_helpfulness_stats(procedure_uuid UUID)
RETURNS TABLE (
  helpful_count BIGINT,
  not_helpful_count BIGINT,
  total_votes BIGINT,
  helpfulness_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE is_helpful = true) as helpful_count,
    COUNT(*) FILTER (WHERE is_helpful = false) as not_helpful_count,
    COUNT(*) as total_votes,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE is_helpful = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      ELSE 0
    END as helpfulness_percentage
  FROM procedure_helpfulness_votes
  WHERE procedure_id = procedure_uuid;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- This migration adds:
-- ✅ unpredicted_cases table with RLS policies
-- ✅ procedure_suggestions table with RLS policies
-- ✅ procedure_helpfulness_votes table with RLS policies
-- ✅ Appropriate indexes for performance
-- ✅ Helper functions for statistics
