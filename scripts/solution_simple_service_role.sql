-- SOLUTION 2: SIMPLE PROFILES POLICIES + SERVICE ROLE FOR ADMIN
-- This avoids recursion entirely by keeping profiles policies simple
-- Admin operations handled at Next.js application level using service_role

-- STEP 1: Drop problematic recursive policies
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_delete ON profiles;

-- STEP 2: Create simple, non-recursive policies
-- Users can only see and modify their own profiles
-- NO admin bypass in the policies themselves

CREATE POLICY profiles_select ON profiles
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
    FOR UPDATE 
    USING (auth.uid() = id);

-- Keep INSERT policy as-is (for new user registration)
-- INSERT policy already exists, no need to recreate

-- DELETE: Only allow users to delete their own profile
CREATE POLICY profiles_delete ON profiles
    FOR DELETE 
    USING (auth.uid() = id);

-- STEP 3: Verify policies are simple and non-recursive
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- STEP 4: Application-Level Admin Strategy
-- In your Next.js app, admin functions should use:
-- 1. SUPABASE_SERVICE_ROLE_KEY for admin operations (bypasses ALL RLS)
-- 2. Regular client for normal user operations

-- Example in Next.js:
-- const adminClient = createClient(url, SERVICE_ROLE_KEY) // Bypasses RLS
-- const userClient = createClient(url, ANON_KEY)          // Uses RLS

-- STEP 5: Update other table policies to avoid profiles recursion
-- All other tables (comunicazioni, rate_pagamenti, etc.) should be updated too