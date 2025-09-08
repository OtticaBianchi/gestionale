-- FINAL MINIMAL RLS POLICIES - UI CONTROLLED ACCESS
-- Since UI perfectly controls button visibility, RLS just needs to be a safety net
-- No recursion, simple ownership checks, admin uses service_role

-- ============================================================================
-- CURRENT UI ACCESS CONTROL (ALREADY IMPLEMENTED ✅):
-- ============================================================================
-- OPERATORE: Cannot see buttons for Ordini, Nuova Busta, Ricerca Avanzata
-- OPERATORE: Cannot drag buste, cannot edit anything (canEdit = false everywhere)
-- MANAGER: Can create/edit own buste, can see all archive, cannot delete
-- ADMIN: Can see everything, admin operations via service_role

-- ============================================================================
-- PROFILES - Already fixed with simple policies ✅
-- ============================================================================
-- profiles_*_simple policies are correct - keep as-is

-- ============================================================================
-- COMUNICAZIONI - Simple ownership-based safety net
-- ============================================================================
DROP POLICY IF EXISTS comunicazioni_select ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_insert ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_update ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_delete ON comunicazioni;

-- SELECT: Users can see communications for buste they created
-- UI already controls who sees what, this just prevents API abuse
CREATE POLICY comunicazioni_select ON comunicazioni
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Users can create communications for their own buste
-- UI already prevents operatori from seeing create buttons
CREATE POLICY comunicazioni_insert ON comunicazioni
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Same as INSERT
CREATE POLICY comunicazioni_update ON comunicazioni
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Block everyone - admin uses service_role
CREATE POLICY comunicazioni_delete ON comunicazioni
    FOR DELETE 
    USING (false);

-- ============================================================================
-- RATE_PAGAMENTI - Same pattern
-- ============================================================================
DROP POLICY IF EXISTS rate_pagamenti_select ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_insert ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_update ON rate_pagamenti;
DROP POLICY IF EXISTS rate_pagamenti_delete ON rate_pagamenti;

CREATE POLICY rate_pagamenti_select ON rate_pagamenti
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY rate_pagamenti_insert ON rate_pagamenti
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY rate_pagamenti_update ON rate_pagamenti
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY rate_pagamenti_delete ON rate_pagamenti
    FOR DELETE 
    USING (false);

-- ============================================================================
-- INFO_PAGAMENTI - Same pattern
-- ============================================================================
DROP POLICY IF EXISTS info_pagamenti_select ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_insert ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_update ON info_pagamenti;
DROP POLICY IF EXISTS info_pagamenti_delete ON info_pagamenti;

CREATE POLICY info_pagamenti_select ON info_pagamenti
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY info_pagamenti_insert ON info_pagamenti
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY info_pagamenti_update ON info_pagamenti
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY info_pagamenti_delete ON info_pagamenti
    FOR DELETE 
    USING (false);

-- ============================================================================
-- ORDINI_MATERIALI - Block all access (admin-only via service_role)
-- ============================================================================
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

-- UI already hides Ordini button from operatori
-- Block all regular access - admin uses service_role
CREATE POLICY ordini_materiali_select ON ordini_materiali FOR SELECT USING (false);
CREATE POLICY ordini_materiali_insert ON ordini_materiali FOR INSERT WITH CHECK (false);
CREATE POLICY ordini_materiali_update ON ordini_materiali FOR UPDATE USING (false);
CREATE POLICY ordini_materiali_delete ON ordini_materiali FOR DELETE USING (false);

-- ============================================================================
-- LAVORAZIONI - Work orders (ownership-based)
-- ============================================================================
DROP POLICY IF EXISTS lavorazioni_select ON lavorazioni;
DROP POLICY IF EXISTS lavorazioni_insert ON lavorazioni;
DROP POLICY IF EXISTS lavorazioni_update ON lavorazioni;
DROP POLICY IF EXISTS lavorazioni_delete ON lavorazioni;

-- SELECT: Users can see lavorazioni for buste they created
CREATE POLICY lavorazioni_select ON lavorazioni
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = lavorazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- INSERT: Users can create lavorazioni for their own buste
CREATE POLICY lavorazioni_insert ON lavorazioni
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = lavorazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Same as INSERT
CREATE POLICY lavorazioni_update ON lavorazioni
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = lavorazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Block everyone - admin uses service_role
CREATE POLICY lavorazioni_delete ON lavorazioni
    FOR DELETE 
    USING (false);

-- ============================================================================
-- MATERIALI - Materials catalog (read-only reference data)
-- ============================================================================
DROP POLICY IF EXISTS materiali_select ON materiali;
DROP POLICY IF EXISTS materiali_insert ON materiali;
DROP POLICY IF EXISTS materiali_update ON materiali;
DROP POLICY IF EXISTS materiali_delete ON materiali;

-- SELECT: Everyone can read materials (reference data)
CREATE POLICY materiali_select ON materiali FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Admin only via service_role
CREATE POLICY materiali_insert ON materiali FOR INSERT WITH CHECK (false);
CREATE POLICY materiali_update ON materiali FOR UPDATE USING (false);
CREATE POLICY materiali_delete ON materiali FOR DELETE USING (false);

-- ============================================================================
-- TIPI_MONTAGGIO - Mounting types (read-only reference data)
-- ============================================================================
DROP POLICY IF EXISTS tipi_montaggio_select ON tipi_montaggio;
DROP POLICY IF EXISTS tipi_montaggio_insert ON tipi_montaggio;
DROP POLICY IF EXISTS tipi_montaggio_update ON tipi_montaggio;
DROP POLICY IF EXISTS tipi_montaggio_delete ON tipi_montaggio;

-- SELECT: Everyone can read mounting types (reference data)
CREATE POLICY tipi_montaggio_select ON tipi_montaggio FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Admin only via service_role
CREATE POLICY tipi_montaggio_insert ON tipi_montaggio FOR INSERT WITH CHECK (false);
CREATE POLICY tipi_montaggio_update ON tipi_montaggio FOR UPDATE USING (false);
CREATE POLICY tipi_montaggio_delete ON tipi_montaggio FOR DELETE USING (false);

-- ============================================================================
-- APPLICATION STRATEGY SUMMARY
-- ============================================================================

-- OPERATORE Implementation:
-- ✅ UI: Cannot see Ordini, Nuova Busta, Ricerca Avanzata buttons
-- ✅ UI: Cannot drag buste, cannot edit anything (canEdit = false)
-- ✅ UI: Can see kanban, voice notes (read-only)
-- 🔧 Backend: Use service_role for read access to all data when needed

-- MANAGER Implementation:
-- ✅ UI: Can see all buttons except admin-only ones
-- ✅ UI: Can create/edit own buste, can access archive
-- 🔧 Backend: Regular client follows RLS (own data), service_role for archive access
-- 🔧 Backend: service_role for duplicating any archived busta

-- ADMIN Implementation:
-- ✅ UI: Can see everything, can delete
-- 🔧 Backend: service_role for all operations (bypasses RLS completely)

-- ============================================================================
-- BENEFITS OF THIS APPROACH
-- ============================================================================
-- ✅ No recursion possible (no role checking in policies)
-- ✅ UI controls actual access (users don't see restricted features)
-- ✅ RLS prevents API manipulation (safety net)
-- ✅ Simple ownership model (managers can't access each other's active data)
-- ✅ Admin bypass via service_role (full control when needed)
-- ✅ Archived data sharing via service_role (managers can duplicate any archive)

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    tablename,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'comunicazioni', 'rate_pagamenti', 'info_pagamenti', 'ordini_materiali', 'lavorazioni', 'materiali', 'tipi_montaggio')
GROUP BY tablename
ORDER BY tablename;