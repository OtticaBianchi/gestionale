-- Manual Backup Strategy for Free Tier Supabase
-- Since automated backups aren't available, we need manual exports

-- STEP 1: Export all table data as CSV/SQL
-- Run these in Supabase SQL Editor and export results as CSV

-- Critical tables with RLS issues (priority backup):
SELECT 'comunicazioni' as table_name, count(*) as record_count FROM comunicazioni
UNION ALL
SELECT 'info_pagamenti', count(*) FROM info_pagamenti  
UNION ALL
SELECT 'rate_pagamenti', count(*) FROM rate_pagamenti
UNION ALL
SELECT 'profiles', count(*) FROM profiles
UNION ALL
SELECT 'lavorazioni', count(*) FROM lavorazioni
UNION ALL
SELECT 'materiali', count(*) FROM materiali
UNION ALL
SELECT 'ordini_materiali', count(*) FROM ordini_materiali
UNION ALL
SELECT 'tipi_montaggio', count(*) FROM tipi_montaggio;

-- STEP 2: Full data export queries (run each separately and save as CSV)

-- Backup profiles (user data)
SELECT * FROM profiles ORDER BY id;

-- Backup comunicazioni (communication history)
SELECT * FROM comunicazioni ORDER BY id;

-- Backup info_pagamenti (payment info)
SELECT * FROM info_pagamenti ORDER BY id;

-- Backup rate_pagamenti (payment rates)  
SELECT * FROM rate_pagamenti ORDER BY id;

-- Backup lavorazioni (work orders)
SELECT * FROM lavorazioni ORDER BY id;

-- Backup materiali (materials)
SELECT * FROM materiali ORDER BY id;

-- Backup ordini_materiali (material orders)
SELECT * FROM ordini_materiali ORDER BY id;

-- Backup tipi_montaggio (mounting types)
SELECT * FROM tipi_montaggio ORDER BY id;

-- STEP 3: Schema backup (table structures and policies)
-- Export table schemas with this query:
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- STEP 4: Current RLS policy backup
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

-- STEP 5: Store results locally
-- Save all CSV exports to local directory: /backups/YYYY-MM-DD/
-- Include timestamp and table name in filenames
-- Example: profiles_2025-08-06_14-30.csv

-- ALTERNATIVE: Use Supabase Studio Table Editor
-- 1. Go to Table Editor in Supabase Studio
-- 2. Select each table
-- 3. Click "Export" button (if available)
-- 4. Save as CSV to local machine

-- VERIFICATION: After backup, verify file sizes match record counts
-- profiles.csv should have same number of rows as SELECT count(*) FROM profiles