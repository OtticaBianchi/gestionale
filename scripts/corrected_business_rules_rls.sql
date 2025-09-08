-- CORRECTED BUSINESS RULES RLS SOLUTION
-- Based on actual business requirements:
-- OPERATORE: Read-only kanban, buste, voice messages
-- MANAGER: Create/modify own buste, kanban with own buste, voice messages, archiviate
-- ADMIN: Everything + delete voice messages, delete buste, ordini page

-- ============================================================================
-- PROFILES - Keep simple (already fixed)
-- ============================================================================
-- profiles_*_simple policies already implemented - keep as-is

-- ============================================================================
-- BUSTE - Core business data access
-- ============================================================================
-- Current buste policies should already be correct
-- Let's verify they exist and work properly

-- ============================================================================
-- COMUNICAZIONI - Based on busta ownership
-- ============================================================================
DROP POLICY IF EXISTS comunicazioni_select ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_insert ON comunicazioni;  
DROP POLICY IF EXISTS comunicazioni_update ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_delete ON comunicazioni;

-- SELECT: Users can see communications for buste they created
-- OPERATORE will see all via service_role in app
CREATE POLICY comunicazioni_select ON comunicazioni
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Only managers can create communications (operatore is read-only)
CREATE POLICY comunicazioni_insert ON comunicazioni
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Only managers can update their communications
CREATE POLICY comunicazioni_update ON comunicazioni
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: No one can delete via regular client (admin uses service_role)
CREATE POLICY comunicazioni_delete ON comunicazioni
    FOR DELETE 
    USING (false);

-- ============================================================================
-- RATE_PAGAMENTI - Payment installments
-- ============================================================================
DROP POLICY IF EXISTS rate_pagamenti_select ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_insert ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_update ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_delete ON rate_pagamenti;

-- SELECT: Users can see payments for their own buste
CREATE POLICY rate_pagamenti_select ON rate_pagamenti
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Managers can create payments for their buste
CREATE POLICY rate_pagamenti_insert ON rate_pagamenti
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Managers can update payments for their buste
CREATE POLICY rate_pagamenti_update ON rate_pagamenti
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Admin only via service_role
CREATE POLICY rate_pagamenti_delete ON rate_pagamenti
    FOR DELETE 
    USING (false);

-- ============================================================================
-- INFO_PAGAMENTI - Payment information
-- ============================================================================
DROP POLICY IF EXISTS info_pagamenti_select ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_insert ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_update ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_delete ON info_pagamenti;

-- SELECT: Users can see payment info for their own buste
CREATE POLICY info_pagamenti_select ON info_pagamenti
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Managers can create payment info for their buste
CREATE POLICY info_pagamenti_insert ON info_pagamenti
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Managers can update payment info for their buste
CREATE POLICY info_pagamenti_update ON info_pagamenti
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Admin only via service_role
CREATE POLICY info_pagamenti_delete ON info_pagamenti
    FOR DELETE 
    USING (false);

-- ============================================================================
-- ORDINI_MATERIALI - Material orders (ADMIN ONLY via service_role)
-- ============================================================================
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

-- ORDINI page is ADMIN ONLY - block all regular access
-- Admin accesses via service_role which bypasses RLS
CREATE POLICY ordini_materiali_select ON ordini_materiali FOR SELECT USING (false);
CREATE POLICY ordini_materiali_insert ON ordini_materiali FOR INSERT WITH CHECK (false);
CREATE POLICY ordini_materiali_update ON ordini_materiali FOR UPDATE USING (false);
CREATE POLICY ordini_materiali_delete ON ordini_materiali FOR DELETE USING (false);

-- ============================================================================
-- VOICE_NOTES - Special handling needed
-- ============================================================================
-- Voice notes should already have proper policies
-- Let's verify they allow:
-- - OPERATORE: Read all voice notes
-- - MANAGER: Read all, create/link to clients and buste
-- - ADMIN: Full access including delete

-- Check current voice_notes policies
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'voice_notes';

-- ============================================================================
-- APPLICATION LEVEL IMPLEMENTATION STRATEGY
-- ============================================================================

-- OPERATORE Implementation:
-- - Use service_role for read-only access to all data
-- - UI prevents any create/edit operations
-- - Kanban shows all buste (via service_role)
-- - Voice messages fully accessible

-- MANAGER Implementation:
-- - Use regular auth client (follows RLS policies)
-- - Can create/modify own buste and related data
-- - Kanban shows only own buste (RLS enforced)
-- - Voice messages accessible with linking to own buste

-- ADMIN Implementation:  
-- - Use service_role for all operations (bypasses RLS)
-- - Full access to ordini page
-- - Can delete buste and voice messages
-- - Manages archiviate for all users

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all policies are in place
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali')
GROUP BY tablename
ORDER BY tablename;