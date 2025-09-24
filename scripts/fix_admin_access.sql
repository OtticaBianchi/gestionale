-- Fix Admin Access Issues
-- Run this in Supabase SQL Editor as admin

-- First, check current admin users
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at;

-- Create admin bypass policies for profiles table
-- Drop existing policies that might be blocking admin access
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create comprehensive admin-first policies
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Check if user has proper admin role
-- If you know your user ID, replace 'YOUR_USER_ID' with actual ID
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';

-- Create a function to promote a user to admin (run once)
CREATE OR REPLACE FUNCTION promote_to_admin(user_email text)
RETURNS void AS $$
DECLARE
    user_id uuid;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;

    -- Update or insert profile
    INSERT INTO profiles (id, role, full_name, created_at, updated_at)
    VALUES (user_id, 'admin', user_email, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET
        role = 'admin',
        updated_at = NOW();

    RAISE NOTICE 'User % promoted to admin', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage example (uncomment and replace with your email):
-- SELECT promote_to_admin('your-email@example.com');

-- Verify the fix by checking policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as policy_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;