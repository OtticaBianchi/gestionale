-- FIX ORDINI_MATERIALI POLICIES - CORRECTED VERSION
-- Problem: Current policies are wrong - they ignore user roles
-- Solution: Implement proper role-based permissions using actual column names

-- STEP 1: Drop existing broken policies
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;

-- STEP 2: Create correct role-based policies using busta_id (not lavorazione_id)

-- SELECT: Everyone can read (operatore, manager, admin)
CREATE POLICY ordini_materiali_select ON ordini_materiali
    FOR SELECT 
    USING (true);

-- INSERT: Only manager and admin can create orders
CREATE POLICY ordini_materiali_insert ON ordini_materiali
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('manager', 'admin')
        )
    );

-- DELETE: Only manager (own orders) and admin (all orders)
CREATE POLICY ordini_materiali_delete ON ordini_materiali
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN buste b ON b.id = ordini_materiali.busta_id
            WHERE p.id = auth.uid() 
            AND (
                p.role = 'admin' OR 
                (p.role = 'manager' AND b.creato_da = auth.uid())
            )
        )
    );

-- UPDATE: Same logic as DELETE - manager for own buste, admin for all
CREATE POLICY ordini_materiali_update ON ordini_materiali
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN buste b ON b.id = ordini_materiali.busta_id
            WHERE p.id = auth.uid() 
            AND (
                p.role = 'admin' OR 
                (p.role = 'manager' AND b.creato_da = auth.uid())
            )
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
WHERE tablename = 'ordini_materiali'
ORDER BY cmd;