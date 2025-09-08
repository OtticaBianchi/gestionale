-- FIX COMUNICAZIONI TABLE RLS POLICIES
-- Problem: Current policy only allows busta creator access, blocking admin and operatore
-- Solution: Implement proper 3-tier access (operatore read, manager own data, admin all)

-- STEP 1: Drop existing problematic policy
DROP POLICY IF EXISTS comunicazioni_select ON comunicazioni;

-- STEP 2: Create proper role-based policies

-- SELECT: All roles can read communications according to their level
CREATE POLICY comunicazioni_select ON comunicazioni
    FOR SELECT 
    USING (
        -- Admin can see all communications
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can see communications for buste they created
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = comunicazioni.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
        OR
        -- Operatore can read all communications (read-only access)
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'operatore'
        )
    );

-- INSERT: Only managers and admin can create communications
CREATE POLICY comunicazioni_insert ON comunicazioni
    FOR INSERT 
    WITH CHECK (
        -- Admin can create communications for any busta
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can create communications only for their own buste
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = comunicazioni.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
    );

-- UPDATE: Same as INSERT - managers for own buste, admin for all
CREATE POLICY comunicazioni_update ON comunicazioni
    FOR UPDATE 
    USING (
        -- Admin can update any communication
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can update communications for their own buste
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = comunicazioni.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
    );

-- DELETE: Only admin can delete communications
CREATE POLICY comunicazioni_delete ON comunicazioni
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
WHERE tablename = 'comunicazioni'
ORDER BY cmd, policyname;