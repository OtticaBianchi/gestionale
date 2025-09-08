-- CLEANUP DUPLICATE RLS POLICIES
-- Problem: Some tables have both old Italian policies and new English policies
-- Solution: Remove all old Italian/descriptive policies, keep only the new standard ones

-- ============================================================================
-- LAVORAZIONI - Remove old Italian policies (has 8, should have 4)
-- ============================================================================
DROP POLICY IF EXISTS "Admin può eliminare lavorazioni" ON lavorazioni;
DROP POLICY IF EXISTS "Responsabile può aggiornare lavorazioni" ON lavorazioni;  
DROP POLICY IF EXISTS "Tutti possono leggere lavorazioni" ON lavorazioni;
DROP POLICY IF EXISTS "Utenti autenticati possono inserire lavorazioni" ON lavorazioni;

-- Keep the new English policies: lavorazioni_delete, lavorazioni_insert, lavorazioni_select, lavorazioni_update

-- ============================================================================
-- MATERIALI - Remove old Italian policy (has 5, should have 4)
-- ============================================================================
DROP POLICY IF EXISTS "Accesso completo per utenti autenticati" ON materiali;

-- Keep the new English policies: materiali_delete, materiali_insert, materiali_select, materiali_update

-- ============================================================================
-- TIPI_MONTAGGIO - Remove old Italian policy (has 5, should have 4)
-- ============================================================================
DROP POLICY IF EXISTS "Tutti possono leggere tipi_montaggio" ON tipi_montaggio;

-- Keep the new English policies: tipi_montaggio_delete, tipi_montaggio_insert, tipi_montaggio_select, tipi_montaggio_update

-- ============================================================================
-- VERIFICATION - Should show exactly 4 policies per table
-- ============================================================================
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali', 'lavorazioni', 'materiali', 'tipi_montaggio')
GROUP BY tablename
ORDER BY tablename;

-- Expected result: All 8 tables should have exactly 4 policies each
-- Total policies should be 32 (8 tables × 4 policies each)