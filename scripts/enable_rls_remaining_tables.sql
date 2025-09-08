-- ENABLE RLS ON REMAINING 5 TABLES
-- Execute this AFTER running all the fix_*_policies.sql scripts
-- This is the final step to complete the security migration

-- IMPORTANT: Only run this after fixing all policies first!
-- Order of execution:
-- 1. fix_profiles_policies.sql
-- 2. fix_comunicazioni_policies.sql  
-- 3. fix_rate_pagamenti_policies.sql
-- 4. fix_info_pagamenti_policies.sql
-- 5. fix_ordini_materiali_policies.sql (already exists)
-- 6. THIS SCRIPT

-- STEP 1: Verify all policies are in place before enabling RLS
-- This should show policies for all 5 tables
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
GROUP BY tablename
ORDER BY tablename;

-- Expected results:
-- comunicazioni: 4 policies (select, insert, update, delete)
-- info_pagamenti: 4 policies (select, insert, update, delete)  
-- ordini_materiali: 4 policies (select, insert, update, delete)
-- profiles: 4 policies (select, insert, update, delete)
-- rate_pagamenti: 4 policies (select, insert, update, delete)

-- STEP 2: Enable RLS on all 5 remaining tables
-- These are currently the tables with policies but RLS disabled

-- Enable RLS for profiles table (CRITICAL - affects admin functions)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS for comunicazioni table  
ALTER TABLE comunicazioni ENABLE ROW LEVEL SECURITY;

-- Enable RLS for rate_pagamenti table
ALTER TABLE rate_pagamenti ENABLE ROW LEVEL SECURITY;

-- Enable RLS for info_pagamenti table
ALTER TABLE info_pagamenti ENABLE ROW LEVEL SECURITY;

-- Enable RLS for ordini_materiali table
ALTER TABLE ordini_materiali ENABLE ROW LEVEL SECURITY;

-- STEP 3: Verify RLS is now enabled on all tables
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename AND schemaname = 'public') as policy_count
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
ORDER BY tablename;

-- All 5 tables should now show rls_enabled = true

-- STEP 4: Final security status check
-- Show all tables with their RLS status and policy counts
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename AND schemaname = 'public') as policy_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY rls_enabled DESC, tablename;

-- STEP 5: Emergency rollback (if needed)
-- Only uncomment if something goes wrong and you need to quickly disable RLS
/*
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE comunicazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE rate_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE info_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE ordini_materiali DISABLE ROW LEVEL SECURITY;
*/