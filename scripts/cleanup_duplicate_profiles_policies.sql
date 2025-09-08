-- CLEANUP DUPLICATE PROFILES POLICIES
-- Problem: Old Italian policies still exist alongside new English policies
-- Solution: Remove the old Italian policies that don't have admin bypass

-- STEP 1: Remove the old Italian policies that lack admin bypass
DROP POLICY IF EXISTS "Gli utenti possono vedere il proprio profilo" ON profiles;
DROP POLICY IF EXISTS "Gli utenti possono aggiornare il proprio profilo" ON profiles;

-- STEP 2: Verify only the correct policies remain
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Expected result: Should show only these 4 policies:
-- profiles_delete (DELETE) - Admin only
-- profiles_insert (INSERT) - New user registration 
-- profiles_select (SELECT) - Admin sees all OR user sees own
-- profiles_update (UPDATE) - Admin updates any OR user updates own