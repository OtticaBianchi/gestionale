-- COMPLETE RLS MIGRATION EXECUTION GUIDE
-- Execute these scripts in Supabase SQL Editor in EXACT ORDER

-- ============================================================================
-- CRITICAL: BACKUP FIRST - DO NOT SKIP THIS STEP
-- ============================================================================
-- 1. Ensure you have a recent backup (weekly Supabase backup or manual export)
-- 2. Test in staging environment if possible
-- 3. Schedule during low-usage window
-- 4. Have rollback scripts ready

-- ============================================================================
-- EXECUTION ORDER (DO NOT CHANGE)
-- ============================================================================

-- STEP 1: Fix all policies AND security definer views BEFORE enabling RLS
-- Execute these in any order (they're independent):

-- 1a. Fix profiles table policies (CRITICAL - Admin functions depend on this)
-- Execute: scripts/fix_profiles_policies.sql

-- 1b. Fix comunicazioni table policies  
-- Execute: scripts/fix_comunicazioni_policies.sql

-- 1c. Fix rate_pagamenti table policies
-- Execute: scripts/fix_rate_pagamenti_policies.sql

-- 1d. Fix info_pagamenti table policies
-- Execute: scripts/fix_info_pagamenti_policies.sql

-- 1e. Fix ordini_materiali table policies (already exists)
-- Execute: scripts/fix_ordini_materiali_policies.sql

-- 1f. Fix Security Definer views (removes unused security-bypassing views)
-- Execute: scripts/fix_security_definer_views.sql

-- STEP 2: Verify all policies are correct AND views are removed
-- Run this query to confirm all 5 tables have 4 policies each:
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(cmd::text, ', ') as operations
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
GROUP BY tablename
ORDER BY tablename;

-- Expected: Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- Verify Security Definer views are removed:
SELECT viewname FROM pg_views 
WHERE viewname IN ('v_ordini_materiali_completi', 'v_ordini_materiali_con_fornitori');
-- Expected: No rows returned (views should be dropped)

-- STEP 3: Enable RLS on all tables at once
-- Execute: scripts/enable_rls_remaining_tables.sql

-- STEP 4: Immediate verification (run right after step 3)
-- This should show all 5 tables with rls_enabled = true
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
ORDER BY tablename;

-- STEP 5: Test admin functions (CRITICAL)
-- Execute: scripts/test_rls_admin_functions.sql
-- Must be run as admin user - all queries should work without permission errors

-- STEP 6: Test role-based access
-- Execute: scripts/test_rls_role_access.sql
-- Run with different user roles (operatore, manager, admin) to verify access levels

-- ============================================================================
-- ROLLBACK PLAN (IF SOMETHING GOES WRONG)
-- ============================================================================

-- EMERGENCY: Disable RLS on all tables immediately
/*
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE comunicazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE rate_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE info_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE ordini_materiali DISABLE ROW LEVEL SECURITY;
*/

-- Then investigate issues and re-run policy fixes before re-enabling RLS

-- ============================================================================
-- SUCCESS CRITERIA CHECKLIST
-- ============================================================================

-- ✅ All 5 tables have RLS enabled
-- ✅ All tables have 4 policies each (SELECT, INSERT, UPDATE, DELETE)
-- ✅ Security Definer views removed (no RLS bypass vulnerabilities)  
-- ✅ Admin can see all profiles and user management works
-- ✅ Admin can see all communications, payments, orders across managers
-- ✅ Manager can create/modify data for own buste only
-- ✅ Operatore can read all data but cannot modify anything
-- ✅ No permission denied errors in admin test script
-- ✅ Role-based access working as expected
-- ✅ Supabase linter shows 0 security errors

-- ============================================================================
-- MIGRATION STATUS TRACKING
-- ============================================================================

-- Before migration: 8/17 tables with RLS issues
-- After migration: 0/17 tables with RLS issues

-- Security improvement:
-- - profiles: Admin user management now works
-- - comunicazioni: Proper role-based access (was creator-only)  
-- - rate_pagamenti: Proper role-based access (was creator-only)
-- - info_pagamenti: Proper role-based access (was creator-only)
-- - ordini_materiali: Proper permissions (was no restrictions)

-- ============================================================================
-- POST-MIGRATION MONITORING
-- ============================================================================

-- Monitor these for the first few days after migration:
-- 1. Admin user management functions
-- 2. User complaints about access issues
-- 3. Application error logs for permission denied errors
-- 4. Performance impact (RLS adds query overhead)

-- If any issues arise, use emergency rollback and investigate