-- MANUAL BACKUP STRATEGY FOR SUPABASE FREE TIER
-- Free tier only has weekly automated backups, so manual backup is critical before RLS migration

-- ============================================================================
-- METHOD 1: CSV EXPORT VIA SUPABASE DASHBOARD (RECOMMENDED)
-- ============================================================================

-- STEP 1: Go to Supabase Dashboard > Table Editor
-- For each critical table, click the table and then "Export as CSV"

-- Priority tables to backup (in order of importance):
-- 1. profiles (user data)
-- 2. buste (main business data)
-- 3. clienti (customer data)
-- 4. comunicazioni (communications)
-- 5. info_pagamenti (payment info)
-- 6. rate_pagamenti (payment installments)
-- 7. ordini_materiali (material orders)
-- 8. lavorazioni (work orders)
-- 9. voice_notes (voice recordings metadata)
-- 10. All other tables

-- STEP 2: Create backup folder structure
-- /backups/2025-08-07-pre-rls/
--   ├── profiles.csv
--   ├── buste.csv  
--   ├── clienti.csv
--   ├── comunicazioni.csv
--   ├── info_pagamenti.csv
--   ├── rate_pagamenti.csv
--   ├── ordini_materiali.csv
--   ├── lavorazioni.csv
--   ├── voice_notes.csv
--   └── metadata.txt (record counts, export timestamp)

-- ============================================================================
-- METHOD 2: SQL EXPORT (FOR STRUCTURE + DATA)
-- ============================================================================

-- Run these queries in Supabase SQL Editor and save results

-- A. Get table structure information
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- B. Get all table row counts (for verification)
SELECT 
    schemaname,
    relname as tablename,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_live_tup as current_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

-- C. Get all RLS policies (current state before changes)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_condition,
    with_check as with_check_condition
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- D. Get all RLS status (current state)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- METHOD 3: APPLICATION-LEVEL BACKUP (IF NEEDED)
-- ============================================================================

-- If you have critical data that's not visible through normal queries due to RLS,
-- you can create a simple backup script in your Next.js app using service_role key

-- Example backup API endpoint (create at /api/admin/backup):
/*
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role bypasses RLS
  )
  
  const tables = ['profiles', 'buste', 'clienti', 'comunicazioni', 'info_pagamenti']
  const backup = {}
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (data) backup[table] = data
  }
  
  return Response.json(backup)
}
*/

-- ============================================================================
-- BACKUP VERIFICATION CHECKLIST
-- ============================================================================

-- Before proceeding with RLS migration, verify:
-- ✅ All critical CSV files downloaded and readable
-- ✅ Row counts match between CSV and database
-- ✅ File sizes are reasonable (not truncated)
-- ✅ Backup folder properly organized and dated
-- ✅ All policy and structure information saved
-- ✅ Test restore process on one small table

-- Critical table row count verification:
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'buste', COUNT(*) FROM buste
UNION ALL  
SELECT 'clienti', COUNT(*) FROM clienti
UNION ALL
SELECT 'comunicazioni', COUNT(*) FROM comunicazioni
UNION ALL
SELECT 'info_pagamenti', COUNT(*) FROM info_pagamenti
UNION ALL
SELECT 'rate_pagamenti', COUNT(*) FROM rate_pagamenti
UNION ALL
SELECT 'ordini_materiali', COUNT(*) FROM ordini_materiali
UNION ALL
SELECT 'lavorazioni', COUNT(*) FROM lavorazioni
UNION ALL
SELECT 'voice_notes', COUNT(*) FROM voice_notes;

-- ============================================================================
-- RESTORE STRATEGY (IF NEEDED)
-- ============================================================================

-- In case of emergency, restore process:
-- 1. Create new Supabase project
-- 2. Run original schema creation scripts
-- 3. Disable RLS on all tables: ALTER TABLE xxx DISABLE ROW LEVEL SECURITY;
-- 4. Import CSV files via Supabase Dashboard
-- 5. Verify data integrity
-- 6. Gradually re-enable security features

-- ============================================================================
-- FREE TIER LIMITATIONS
-- ============================================================================

-- ⚠️ Free tier backup limitations:
-- - No point-in-time recovery
-- - Weekly automated backups only
-- - Manual backup via CSV export only
-- - No pg_dump access
-- - Limited storage for backup files

-- 💡 Workarounds:
-- - Regular CSV exports (manual or via API)
-- - Store critical backups in Git LFS or cloud storage
-- - Consider upgrade to Pro for better backup options
-- - Test restore process regularly

-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================

-- BEFORE RLS MIGRATION:
-- ✅ Export all critical tables to CSV
-- ✅ Save table structure and policy information
-- ✅ Verify row counts match
-- ✅ Test backup file integrity
-- ✅ Create restore procedure documentation
-- ✅ Inform team of maintenance window

-- READY TO PROCEED:
-- ✅ Backup verified and complete
-- ✅ Rollback plan documented  
-- ✅ Emergency contact information ready
-- ✅ Low-usage time window scheduled