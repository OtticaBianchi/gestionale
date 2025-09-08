-- CLEANUP DUPLICATE COMUNICAZIONI POLICIES
-- Problem: Old policy still exists alongside new policies
-- Solution: Remove the old policy that doesn't have proper role hierarchy

-- STEP 1: Remove the old policy
DROP POLICY IF EXISTS "Users can access communications from their company" ON comunicazioni;

-- STEP 2: Verify only the correct policies remain
SELECT 
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'comunicazioni'
ORDER BY cmd, policyname;

-- Expected result: Should show only these 4 policies:
-- comunicazioni_delete (DELETE) - Admin only
-- comunicazioni_insert (INSERT) - Admin + Manager for own buste
-- comunicazioni_select (SELECT) - Admin all + Manager own + Operatore all (read-only)
-- comunicazioni_update (UPDATE) - Admin all + Manager own buste