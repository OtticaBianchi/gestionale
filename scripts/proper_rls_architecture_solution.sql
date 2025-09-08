-- PROPER RLS ARCHITECTURE SOLUTION
-- Problem: Infinite recursion when profiles policies query profiles table
-- Solution: Use JWT claims or application-level role management

-- ============================================================================
-- ANALYSIS: Why Recursion Occurs
-- ============================================================================
-- When a user queries profiles table:
-- 1. RLS policy runs to check permissions
-- 2. Policy queries profiles table to check user role
-- 3. This triggers RLS policy again (recursion)
-- 4. PostgreSQL detects infinite loop and throws error

-- ============================================================================
-- SOLUTION 1: JWT CLAIMS-BASED APPROACH (RECOMMENDED)
-- ============================================================================
-- Store user role in JWT claims, avoid querying profiles table

-- Step 1: Check if role exists in JWT claims
SELECT auth.jwt() ->> 'user_metadata' ->> 'role' as jwt_role;

-- Step 2: Create non-recursive policies using JWT claims
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- SELECT: Use JWT role claim instead of querying profiles table
CREATE POLICY profiles_select ON profiles
    FOR SELECT 
    USING (
        -- Admin role from JWT can see all profiles
        (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin')
        OR
        -- All users can see their own profile
        (auth.uid() = id)
    );

-- UPDATE: Same pattern for updates
CREATE POLICY profiles_update ON profiles
    FOR UPDATE 
    USING (
        -- Admin role from JWT can update any profile
        (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin')
        OR
        -- Users can update their own profile
        (auth.uid() = id)
    );

-- ============================================================================
-- SOLUTION 2: SIMPLE NON-RECURSIVE APPROACH
-- ============================================================================
-- Remove admin bypass from profiles policies, handle at application level

/*
-- Simple profiles policies (no admin bypass)
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

CREATE POLICY profiles_select ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admin operations use service_role key in Next.js app
*/

-- ============================================================================
-- SOLUTION 3: SECURITY DEFINER FUNCTION APPROACH
-- ============================================================================
-- Create a function that checks role without triggering RLS

/*
-- Create function that bypasses RLS for role checking
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;
    
    RETURN COALESCE(user_role, 'operatore');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;

-- Use function in policies (avoids recursion)
CREATE POLICY profiles_select ON profiles
    FOR SELECT 
    USING (
        (get_user_role(auth.uid()) = 'admin') OR (auth.uid() = id)
    );
*/

-- ============================================================================
-- RECOMMENDATION
-- ============================================================================
-- Use SOLUTION 1 (JWT claims) if possible
-- Use SOLUTION 2 (simple + service_role) as fallback
-- SOLUTION 3 (security definer) is more complex but most flexible

-- ============================================================================
-- TEST CURRENT JWT STRUCTURE
-- ============================================================================
-- Check what's available in current JWT
SELECT 
    auth.uid() as user_id,
    auth.jwt() as full_jwt,
    auth.jwt() -> 'user_metadata' as user_metadata,
    auth.jwt() ->> 'user_metadata' ->> 'role' as role_from_jwt;