-- FORCE FIX PROFILES RECURSION - Complete replacement
-- The previous drops didn't work, so we need to force replace the policies

-- STEP 1: Force drop all policies with CASCADE
DROP POLICY profiles_select ON profiles CASCADE;
DROP POLICY profiles_update ON profiles CASCADE; 
DROP POLICY profiles_delete ON profiles CASCADE;
DROP POLICY profiles_insert ON profiles CASCADE;

-- STEP 2: Create completely new, simple policies
CREATE POLICY profiles_select_simple ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY profiles_update_simple ON profiles
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY profiles_insert_simple ON profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_delete_simple ON profiles
    FOR DELETE 
    USING (auth.uid() = id);

-- STEP 3: Verify the new simple policies
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- Expected: All policies should show simple "auth.uid() = id" conditions
-- No references to profiles table should exist