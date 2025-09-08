-- RLS Policy Analysis Script
-- Run this in Supabase SQL Editor to document current state

-- 1. List all existing RLS policies with details
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as policy_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Check current RLS status for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Find tables with policies but RLS disabled (our security issues)
SELECT DISTINCT
    p.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count
FROM pg_policies p
JOIN pg_tables t ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE p.schemaname = 'public' AND t.rowsecurity = false
GROUP BY p.tablename, t.rowsecurity
ORDER BY p.tablename;

-- 4. Analyze Security Definer functions and views
SELECT 
    schemaname,
    viewname,
    definition,
    viewowner
FROM pg_views 
WHERE schemaname = 'public'
  AND (definition ILIKE '%SECURITY DEFINER%' OR viewname LIKE 'v_%')
ORDER BY viewname;

-- 5. Check for any triggers that might affect RLS
SELECT 
    event_object_schema,
    event_object_table,
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;