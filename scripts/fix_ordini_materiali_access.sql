-- FIX ORDINI_MATERIALI ACCESS FOR MATERIALITAB
-- Problem: ordini_materiali policies block ALL access, preventing MaterialiTab from showing
-- Solution: Allow users to see ordini_materiali for their own buste

-- ============================================================================
-- ORDINI_MATERIALI - Allow ownership-based access for MaterialiTab
-- ============================================================================
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

-- SELECT: Users can see material orders for buste they created
-- This allows MaterialiTab to display orders and populate BustaCard info
CREATE POLICY ordini_materiali_select ON ordini_materiali
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Users can create material orders for their own buste
-- MaterialiTab needs this to create new orders
CREATE POLICY ordini_materiali_insert ON ordini_materiali
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Users can update material orders for their own buste
CREATE POLICY ordini_materiali_update ON ordini_materiali
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Users can delete material orders for their own buste
CREATE POLICY ordini_materiali_delete ON ordini_materiali
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- NOTE: The Ordini page (filtri-ordini) is ADMIN-ONLY controlled by UI
-- The MaterialiTab within buste details needs access to ordini_materiali data
-- These are different use cases:
-- 1. MaterialiTab: Shows orders for specific busta (ownership-based)
-- 2. Ordini page: Shows all orders system-wide (admin-only via UI + service_role)

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'ordini_materiali'
ORDER BY cmd;