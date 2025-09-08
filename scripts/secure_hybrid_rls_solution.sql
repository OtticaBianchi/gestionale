-- SECURE HYBRID RLS SOLUTION
-- Combines database-level security with application-level flexibility
-- Avoids recursion while maintaining strong security

-- ============================================================================
-- STRATEGY: Use busta ownership + service_role for admin
-- ============================================================================
-- 1. RLS policies check data ownership (busta.creato_da)
-- 2. No role checking in RLS (avoids recursion)
-- 3. Admin operations use service_role key (bypasses RLS)
-- 4. App-level UI controls what users see/can do

-- ============================================================================
-- PROFILES - Keep simple (already fixed)
-- ============================================================================
-- profiles_*_simple policies already implemented - keep as-is

-- ============================================================================
-- COMUNICAZIONI - Ownership-based security
-- ============================================================================
DROP POLICY IF EXISTS comunicazioni_select ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_insert ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_update ON comunicazioni;
DROP POLICY IF EXISTS comunicazioni_delete ON comunicazioni;

-- SELECT: Users can see communications for buste they created
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
CREATE POLICY comunicazioni_insert ON comunicazioni
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- UPDATE: Users can update communications for their own buste
CREATE POLICY comunicazioni_update ON comunicazioni
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- DELETE: Users can delete communications for their own buste
CREATE POLICY comunicazioni_delete ON comunicazioni
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = comunicazioni.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- ============================================================================
-- RATE_PAGAMENTI - Ownership-based security
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
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = rate_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- ============================================================================
-- INFO_PAGAMENTI - Ownership-based security
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
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = info_pagamenti.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- ============================================================================
-- ORDINI_MATERIALI - Ownership-based security
-- ============================================================================
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

CREATE POLICY ordini_materiali_select ON ordini_materiali
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY ordini_materiali_insert ON ordini_materiali
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY ordini_materiali_update ON ordini_materiali
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

CREATE POLICY ordini_materiali_delete ON ordini_materiali
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM buste 
            WHERE buste.id = ordini_materiali.busta_id 
            AND buste.creato_da = auth.uid()
        )
    );

-- ============================================================================
-- SECURITY SUMMARY
-- ============================================================================
-- 1. Database enforces: Users can only access their own buste data
-- 2. No recursion: No policies query profiles table
-- 3. Admin access: Via service_role key (bypasses ALL RLS)
-- 4. Operatore access: App-level filtering (service_role for read-only)
-- 5. Manager isolation: Database prevents access to other managers' data
-- 6. Strong foundation: Even if app is compromised, users can't see others' data