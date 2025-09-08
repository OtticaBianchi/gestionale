-- FIX PROFILES TABLE RLS POLICIES - CRITICAL FOR ADMIN FUNCTIONS
-- Problem: Current policy (auth.uid() = id) blocks admin user management
-- Solution: Add admin bypass to allow admin role full access

-- STEP 1: Drop existing problematic policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- STEP 2: Create admin-bypass policies with proper role hierarchy

-- SELECT: Users see own profile, admin sees all profiles
CREATE POLICY profiles_select ON profiles
    FOR SELECT 
    USING (
        -- Admin can see all profiles (for user management)
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Non-admin users can only see their own profile
        (auth.uid() = id)
    );

-- UPDATE: Users can update own profile, admin can update any profile
CREATE POLICY profiles_update ON profiles
    FOR UPDATE 
    USING (
        -- Admin can update any profile (role changes, avatar assignment)
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Non-admin users can only update their own profile
        (auth.uid() = id)
    );

-- INSERT: Only for new user registration (handled by trigger)
CREATE POLICY profiles_insert ON profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- DELETE: Only admin can delete user profiles
CREATE POLICY profiles_delete ON profiles
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- STEP 3: Verify new policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- STEP 4: Test critical admin functions (run as admin user)
-- These should now work after the policy fix:
-- SELECT * FROM profiles; -- Admin should see all users
-- UPDATE profiles SET role = 'manager' WHERE id = 'some-user-id'; -- Admin should be able to change roles