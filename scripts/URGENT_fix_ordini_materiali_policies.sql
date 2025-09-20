-- URGENT FIX: RLS Policies for ordini_materiali table - ROLE BASED ACCESS
-- This fixes the "new row violates row-level security policy" error
-- ADMIN + MANAGER = Full access to all orders
-- OPERATORE = Read-only access
-- Run this in Supabase SQL Editor IMMEDIATELY

-- 1. Drop the restrictive policies that block all access
DROP POLICY IF EXISTS ordini_materiali_select ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_insert ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_update ON ordini_materiali;
DROP POLICY IF EXISTS ordini_materiali_delete ON ordini_materiali;

-- 2. Create ROLE-based policies
-- All authenticated users can SELECT (read)
CREATE POLICY ordini_materiali_select ON ordini_materiali
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- ADMIN + MANAGER can INSERT (create new orders)
CREATE POLICY ordini_materiali_insert ON ordini_materiali
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ADMIN + MANAGER can UPDATE (modify orders)
CREATE POLICY ordini_materiali_update ON ordini_materiali
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ONLY ADMIN can DELETE orders
CREATE POLICY ordini_materiali_delete ON ordini_materiali
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 3. Verify RLS is enabled (should already be)
ALTER TABLE ordini_materiali ENABLE ROW LEVEL SECURITY;