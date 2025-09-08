-- FIX INFO_PAGAMENTI TABLE RLS POLICIES
-- Problem: Current policy only allows busta creator access, blocking admin and operatore
-- Solution: Implement proper 3-tier access (operatore read, manager own data, admin all)

-- STEP 1: Drop existing problematic policy
DROP POLICY IF EXISTS info_pagamenti_select ON info_pagamenti;

-- STEP 2: Create proper role-based policies

-- SELECT: All roles can read payment info according to their level
CREATE POLICY info_pagamenti_select ON info_pagamenti
    FOR SELECT 
    USING (
        -- Admin can see all payment information
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can see payment info for buste they created
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = info_pagamenti.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
        OR
        -- Operatore can read all payment info (read-only access)
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'operatore'
        )
    );

-- INSERT: Only managers and admin can create payment info
CREATE POLICY info_pagamenti_insert ON info_pagamenti
    FOR INSERT 
    WITH CHECK (
        -- Admin can create payment info for any busta
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can create payment info only for their own buste
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = info_pagamenti.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
    );

-- UPDATE: Same as INSERT - managers for own buste, admin for all
CREATE POLICY info_pagamenti_update ON info_pagamenti
    FOR UPDATE 
    USING (
        -- Admin can update any payment info
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        OR
        -- Manager can update payment info for their own buste
        EXISTS (
            SELECT 1 FROM buste b
            JOIN profiles p ON p.id = auth.uid()
            WHERE b.id = info_pagamenti.busta_id 
            AND b.creato_da = auth.uid()
            AND p.role = 'manager'
        )
    );

-- DELETE: Only admin can delete payment info
CREATE POLICY info_pagamenti_delete ON info_pagamenti
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
WHERE tablename = 'info_pagamenti'
ORDER BY cmd, policyname;