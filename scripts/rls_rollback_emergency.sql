-- EMERGENCY ROLLBACK SCRIPT
-- Use this if RLS changes break your application

-- ⚠️  CRITICAL: Keep this script handy during migration
-- Run this immediately if anything breaks

BEGIN;

-- Disable RLS on all affected tables
ALTER TABLE public.comunicazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lavorazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiali DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordini_materiali DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;

-- Log the rollback action
INSERT INTO public.migration_log (action, timestamp, notes)
VALUES ('EMERGENCY_ROLLBACK_RLS_DISABLED', NOW(), 'All RLS policies disabled due to issues');

-- Verify all tables have RLS disabled
SELECT 
    tablename,
    rowsecurity as rls_still_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND rowsecurity = true;

-- If the above query returns any rows, RLS is still enabled on those tables
-- This should return NO ROWS after successful rollback

COMMIT;

-- Post-rollback verification queries
-- Run these to ensure app functionality is restored

-- Test 1: Can access profiles
SELECT 'Profile access test' as test, COUNT(*) as count FROM profiles;

-- Test 2: Can access materials  
SELECT 'Materials access test' as test, COUNT(*) as count FROM materiali;

-- Test 3: Can access communications
SELECT 'Communications access test' as test, COUNT(*) as count FROM comunicazioni;

-- Test 4: Can access lavorazioni
SELECT 'Lavorazioni access test' as test, COUNT(*) as count FROM lavorazioni;

-- Test 5: Views still work
SELECT 'View test 1' as test, COUNT(*) as count FROM v_ordini_materiali_completi;
SELECT 'View test 2' as test, COUNT(*) as count FROM v_ordini_materiali_con_fornitori;