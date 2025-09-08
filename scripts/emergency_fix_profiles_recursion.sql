-- EMERGENCY FIX: Profiles Infinite Recursion
-- Problem: profiles policy queries profiles table to check role, causing recursion
-- Solution: Use simpler non-recursive policies

-- STEP 1: Drop the problematic recursive policies
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- STEP 2: Create non-recursive policies
-- Key insight: Don't query profiles table within profiles policies

-- SELECT: Simple approach - users see own profile only
-- Admin bypass will be handled at application level for now
CREATE POLICY profiles_select ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- UPDATE: Users can update own profile only  
-- Admin bypass will be handled at application level for now
CREATE POLICY profiles_update ON profiles
    FOR UPDATE 
    USING (auth.uid() = id);

-- STEP 3: Keep INSERT and DELETE as they don't cause recursion
-- (These should already exist and work fine)

-- STEP 4: Verify policies
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- TEMPORARY WORKAROUND:
-- For admin functions, your Next.js app should use SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS entirely for admin operations