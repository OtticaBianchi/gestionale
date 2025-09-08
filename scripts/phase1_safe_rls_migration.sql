-- PHASE 1: Ultra-Safe RLS Migration
-- START WITH LEAST CRITICAL TABLE: tipi_montaggio

-- ⚠️  MANDATORY: Run this in STAGING ENVIRONMENT first
-- ⚠️  MANDATORY: Have rollback script ready
-- ⚠️  MANDATORY: Full database backup completed

-- Step 1: Create migration log table (if not exists)
CREATE TABLE IF NOT EXISTS public.migration_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    user_id UUID DEFAULT auth.uid()
);

-- Step 2: Log the start of migration
INSERT INTO public.migration_log (action, notes)
VALUES ('RLS_MIGRATION_PHASE1_START', 'Starting with tipi_montaggio table');

-- Step 3: Document current state before changes
INSERT INTO public.migration_log (action, notes)
SELECT 
    'CURRENT_RLS_STATUS',
    'Table: ' || tablename || ', RLS: ' || rowsecurity::TEXT
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'tipi_montaggio';

-- Step 4: Enable RLS on tipi_montaggio (safest table to start)
BEGIN;

-- Enable RLS
ALTER TABLE public.tipi_montaggio ENABLE ROW LEVEL SECURITY;

-- Verify it worked
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT rowsecurity INTO rls_enabled 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'tipi_montaggio';
    
    IF rls_enabled THEN
        INSERT INTO public.migration_log (action, notes)
        VALUES ('RLS_ENABLED_SUCCESS', 'tipi_montaggio RLS enabled successfully');
        RAISE NOTICE 'SUCCESS: RLS enabled on tipi_montaggio';
    ELSE
        RAISE EXCEPTION 'FAILED: RLS was not enabled on tipi_montaggio';
    END IF;
END $$;

COMMIT;

-- Step 5: Test queries still work
-- This should return data if RLS policy allows it
SELECT 
    'POST_RLS_TEST' as test_type,
    COUNT(*) as record_count,
    MIN(id) as min_id,
    MAX(id) as max_id
FROM public.tipi_montaggio;

-- Step 6: Log completion
INSERT INTO public.migration_log (action, notes)
VALUES ('RLS_MIGRATION_PHASE1_COMPLETE', 'tipi_montaggio migration completed successfully');

-- Step 7: Verification query
SELECT 
    'FINAL_VERIFICATION' as status,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'tipi_montaggio';

-- NEXT STEPS:
-- 1. Test your application thoroughly
-- 2. Check if any API endpoints break
-- 3. Monitor application logs for errors
-- 4. If everything works for 24-48 hours, proceed to next table
-- 5. If anything breaks, run the rollback script immediately

COMMENT ON TABLE public.tipi_montaggio IS 'RLS enabled in Phase 1 of security migration';