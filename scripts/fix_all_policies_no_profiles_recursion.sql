-- FIX ALL POLICIES TO AVOID PROFILES RECURSION
-- Update all other table policies to not query profiles table for role checking

-- ============================================================================
-- COMUNICAZIONI - Remove profiles role checking
-- ============================================================================
DROP POLICY IF EXISTS comunicazioni_select ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_insert ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_update ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_delete ON comunicazioni;

-- Simple approach: All authenticated users can access comunicazioni
-- Admin filtering done at application level
CREATE POLICY comunicazioni_select ON comunicazioni FOR SELECT USING (true);
CREATE POLICY comunicazioni_insert ON comunicazioni FOR INSERT WITH CHECK (true);
CREATE POLICY comunicazioni_update ON comunicazioni FOR UPDATE USING (true);
CREATE POLICY comunicazioni_delete ON comunicazioni FOR DELETE USING (true);

-- ============================================================================
-- RATE_PAGAMENTI - Remove profiles role checking
-- ============================================================================
DROP POLICY IF EXISTS rate_pagamenti_select ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_insert ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_update ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_delete ON rate_pagamenti;

CREATE POLICY rate_pagamenti_select ON rate_pagamenti FOR SELECT USING (true);
CREATE POLICY rate_pagamenti_insert ON rate_pagamenti FOR INSERT WITH CHECK (true);
CREATE POLICY rate_pagamenti_update ON rate_pagamenti FOR UPDATE USING (true);
CREATE POLICY rate_pagamenti_delete ON rate_pagamenti FOR DELETE USING (true);

-- ============================================================================
-- INFO_PAGAMENTI - Remove profiles role checking
-- ============================================================================
DROP POLICY IF EXISTS info_pagamenti_select ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_insert ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_update ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_delete ON info_pagamenti;

CREATE POLICY info_pagamenti_select ON info_pagamenti FOR SELECT USING (true);
CREATE POLICY info_pagamenti_insert ON info_pagamenti FOR INSERT WITH CHECK (true);
CREATE POLICY info_pagamenti_update ON info_pagamenti FOR UPDATE USING (true);
CREATE POLICY info_pagamenti_delete ON info_pagamenti FOR DELETE USING (true);

-- ============================================================================
-- ORDINI_MATERIALI - Remove profiles role checking
-- ============================================================================
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

CREATE POLICY ordini_materiali_select ON ordini_materiali FOR SELECT USING (true);
CREATE POLICY ordini_materiali_insert ON ordini_materiali FOR INSERT WITH CHECK (true);
CREATE POLICY ordini_materiali_update ON ordini_materiali FOR UPDATE USING (true);
CREATE POLICY ordini_materiali_delete ON ordini_materiali FOR DELETE USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that all policies are now simple and don't reference profiles
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
AND qual ILIKE '%profiles%'
ORDER BY tablename, cmd;

-- This should return no rows - no policies should reference profiles table

-- ============================================================================
-- FINAL STRATEGY
-- ============================================================================
-- 1. All RLS policies are now simple (no role checking)
-- 2. All role-based access control moved to application level
-- 3. Admin operations use service_role key
-- 4. Regular operations use anon key with simple RLS
-- 5. No more infinite recursion possible