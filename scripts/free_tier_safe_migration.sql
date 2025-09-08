-- SAFE RLS MIGRATION FOR FREE TIER
-- No automated backups available - using incremental approach

-- PHASE 1: Start with safest table (reference data only)
-- tipi_montaggio has simple policies and low risk

-- STEP 1: Test current policy before enabling RLS
-- Run this to see current access:
SELECT 'Before RLS' as status, COUNT(*) as records FROM tipi_montaggio;

-- STEP 2: Check current policy (should allow read for all, admin-only write)
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual as policy_expression
FROM pg_policies 
WHERE tablename = 'tipi_montaggio';

-- STEP 3: Enable RLS on safest table first
-- If this breaks, we know policies need fixing
ALTER TABLE public.tipi_montaggio ENABLE ROW LEVEL SECURITY;

-- STEP 4: Immediate verification test
SELECT 'After RLS Enabled' as status, COUNT(*) as records FROM tipi_montaggio;

-- STEP 5: Test different user roles
-- (This requires testing from different user accounts)
-- If count changes or fails, immediately run:
-- ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;

-- STEP 6: If tipi_montaggio works, proceed to next safest
-- materiali (single policy, well-defined)

-- STEP 7: Test materiali policy before enabling
SELECT 
    policyname,
    permissive, 
    roles,
    cmd,
    qual as policy_expression
FROM pg_policies 
WHERE tablename = 'materiali';

-- STEP 8: Enable RLS on materiali
-- Only do this if tipi_montaggio test passed
-- ALTER TABLE public.materiali ENABLE ROW LEVEL SECURITY;

-- STEP 9: Test materiali access
-- SELECT 'Materiali after RLS' as status, COUNT(*) as records FROM materiali;

-- EMERGENCY ROLLBACK for current table:
-- ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.materiali DISABLE ROW LEVEL SECURITY;

-- CRITICAL TABLES TO AVOID UNTIL POLICIES FIXED:
-- - profiles (will break admin functions)  
-- - comunicazioni (complex business logic)
-- - info_pagamenti (financial data)
-- - rate_pagamenti (payment rates)
-- - lavorazioni (complex policies, 4 rules)
-- - ordini_materiali (complex policies, 4 rules)

-- SUCCESS CRITERIA:
-- 1. User can still access application
-- 2. Record counts don't change unexpectedly
-- 3. No permission errors in app
-- 4. Admin functions still work
-- 5. Can immediately rollback if needed

-- NEXT PHASE: Only after verifying simple tables work
-- Fix admin bypass policies for complex tables