-- STEP 1: SAFEST TABLE MIGRATION - tipi_montaggio
-- This is reference data with simple policies, lowest risk

-- PRE-MIGRATION CHECKS
-- =====================

-- Check 1: Current record count (save this number)
SELECT 'BEFORE MIGRATION - Record Count' as check_type, COUNT(*) as count FROM tipi_montaggio;

-- Check 2: Current RLS status (should be DISABLED)
SELECT 
    'BEFORE MIGRATION - RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tipi_montaggio';

-- Check 3: Current policies (should exist)
SELECT 
    'BEFORE MIGRATION - Policies' as check_type,
    policyname,
    cmd as operation,
    qual as condition
FROM pg_policies 
WHERE tablename = 'tipi_montaggio';

-- MIGRATION EXECUTION
-- ===================

-- CRITICAL: Only run this after verifying above checks look correct
-- Enable RLS on tipi_montaggio
ALTER TABLE public.tipi_montaggio ENABLE ROW LEVEL SECURITY;

-- POST-MIGRATION VERIFICATION
-- ===========================

-- Test 1: Can still access data (count should match pre-migration)
SELECT 'AFTER MIGRATION - Record Count' as check_type, COUNT(*) as count FROM tipi_montaggio;

-- Test 2: Can read specific records
SELECT 'AFTER MIGRATION - Data Access' as check_type, id, nome, prezzo FROM tipi_montaggio LIMIT 3;

-- Test 3: RLS is now enabled
SELECT 
    'AFTER MIGRATION - RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tipi_montaggio';

-- ROLLBACK IF NEEDED
-- ==================
-- If any test fails or app breaks, run this immediately:
-- ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;

-- SUCCESS CRITERIA:
-- ✅ Record count unchanged
-- ✅ Can read data normally  
-- ✅ RLS shows as enabled
-- ✅ App still works (test in browser)
-- ✅ Admin functions work (test avatar management)

-- NEXT STEP: Only if all tests pass
-- Proceed to materiali table migration