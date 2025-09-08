# ULTRA-SAFE RLS MIGRATION PLAN

⚠️ **CRITICAL**: This plan prioritizes data safety above all else. Follow each step exactly and NEVER skip safety checks.

## Phase 0: Pre-Migration Safety Checklist (MANDATORY)

### 1. **Complete Database Backup**
```sql
-- Run in Supabase SQL Editor before ANY changes
-- Export all data to CSV/SQL dumps via Supabase Dashboard
-- Verify backups by downloading and checking file sizes
```

### 2. **Document Current State**
```sql
-- List all existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity, forcerlsonowner 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 3. **Create Staging Environment**
- Use Supabase branching or create separate project
- Import production data to staging
- Test ALL changes in staging first

## Phase 1: Analysis & Preparation (ZERO RISK)

### Step 1.1: Document Existing Policies
Create this file to understand what policies exist:

```sql
-- Save output to docs/current_rls_policies.sql
\copy (SELECT 'Table: ' || tablename || E'\nPolicy: ' || policyname || E'\nCommand: ' || cmd || E'\nExpression: ' || qual || E'\n---' FROM pg_policies WHERE schemaname = 'public') TO 'current_policies.txt';
```

### Step 1.2: Create Test Scripts
Scripts to validate each table works correctly after RLS enabled.

## Phase 2: Single Table Testing (LOW RISK)

### Step 2.1: Start with LEAST CRITICAL table
**Recommendation**: Start with `tipi_montaggio` (seems like reference data)

### Step 2.2: Enable RLS on ONE table only
```sql
-- IN STAGING ENVIRONMENT ONLY
ALTER TABLE public.tipi_montaggio ENABLE ROW LEVEL SECURITY;

-- Test all application functions still work
-- Test queries from your app
-- Check if any API endpoints break
```

### Step 2.3: Rollback Script Ready
```sql
-- ROLLBACK: Disable RLS if anything breaks
ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;
```

## Phase 3: Profiles Table (MEDIUM RISK)

⚠️ **CRITICAL**: Profiles is core to authentication - extreme caution needed

### Step 3.1: Validate Existing Policy
```sql
-- Check what the existing policy allows
-- "Users can see their own profile" 
-- "Users can update their own profile"
```

### Step 3.2: Test Authentication Flow
1. Enable RLS on profiles in staging
2. Test complete login/logout cycle
3. Test profile loading in UserContext
4. Test admin functions (will likely break - this is expected)

## Phase 4: Company-Based Tables (HIGH RISK)

Tables: `comunicazioni`, `info_pagamenti`, `rate_pagamenti`, `ordini_materiali`

⚠️ **WARNING**: These have company-based policies but your app queries don't show company filtering

### Step 4.1: Policy Analysis Required
Need to understand what "their company" means in policies:
- How is company determined? 
- Is it based on user profile?
- Do queries need company_id filters?

### Step 4.2: Application Code Updates
Before enabling RLS, may need to modify queries to include proper filters.

## Phase 5: Security Definer Views (HIGH RISK)

Views: `v_ordini_materiali_completi`, `v_ordini_materiali_con_fornitori`

### Issue
These views bypass user permissions and could expose data inappropriately.

### Solution
Recreate as SECURITY INVOKER views after understanding their purpose.

## Emergency Rollback Plan

### Instant Disable All RLS
```sql
-- EMERGENCY: Disable RLS on all tables immediately
ALTER TABLE public.comunicazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lavorazioni DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiali DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordini_materiali DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_pagamenti DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipi_montaggio DISABLE ROW LEVEL SECURITY;
```

### Recovery Steps
1. Restore from backup if data corruption
2. Check application functionality
3. Investigate what went wrong before retry

## Safety Checkpoints

Before each phase:
- [ ] Backup verified and downloaded
- [ ] Staging environment tested
- [ ] Rollback script ready
- [ ] Team notified of maintenance window
- [ ] Monitor application errors in real-time

## Recommended Timeline

- **Week 1**: Setup staging, analysis, documentation
- **Week 2**: Test single table (tipi_montaggio)  
- **Week 3**: Test profiles table carefully
- **Week 4**: Analyze and plan company-based tables

**NEVER rush this process. Data integrity is more important than timeline.**