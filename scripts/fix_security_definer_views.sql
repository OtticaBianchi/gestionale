-- FIX SECURITY DEFINER VIEWS SECURITY ISSUES
-- Problem: Two views have SECURITY DEFINER property which bypasses RLS
-- Solution: Either remove SECURITY DEFINER or drop unused views

-- STEP 1: Check if these views are actually used anywhere
-- Query to see the view definitions
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname IN ('v_ordini_materiali_completi', 'v_ordini_materiali_con_fornitori')
ORDER BY viewname;

-- STEP 2: Check view usage (should be empty if not used in application)
-- This query looks for any references to these views in stored functions
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%v_ordini_materiali_completi%' 
   OR routine_definition ILIKE '%v_ordini_materiali_con_fornitori%';

-- STEP 3A: OPTION 1 - Drop unused views (RECOMMENDED)
-- Based on code analysis, these views are not used in the application
-- They only exist in TypeScript definitions but no actual queries use them

DROP VIEW IF EXISTS v_ordini_materiali_completi;
DROP VIEW IF EXISTS v_ordini_materiali_con_fornitori;

-- STEP 3B: OPTION 2 - Remove SECURITY DEFINER (if views are needed)
-- Only use this if you discover the views are actually needed
-- This would recreate them without SECURITY DEFINER property

/*
-- First get the view definitions without SECURITY DEFINER
SELECT definition FROM pg_views WHERE viewname = 'v_ordini_materiali_completi';
SELECT definition FROM pg_views WHERE viewname = 'v_ordini_materiali_con_fornitori';

-- Then drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS v_ordini_materiali_completi;
DROP VIEW IF EXISTS v_ordini_materiali_con_fornitori;

-- Recreate with modified definitions (replace SECURITY DEFINER with regular view)
-- You would need to paste the actual view definitions here without SECURITY DEFINER
*/

-- STEP 4: Verify views are removed and security issues resolved
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname IN ('v_ordini_materiali_completi', 'v_ordini_materiali_con_fornitori');

-- This should return no rows if views were successfully dropped

-- STEP 5: Clean up TypeScript definitions (optional)
-- After dropping the views, you may want to regenerate database.types.ts
-- to remove the unused view definitions from the TypeScript types

-- IMPACT ASSESSMENT:
-- ✅ Views are not used in application code (only in TypeScript definitions)
-- ✅ Safe to drop without affecting functionality
-- ✅ Eliminates security risk from SECURITY DEFINER bypass
-- ✅ Reduces database objects and maintenance overhead