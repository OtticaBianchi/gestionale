-- Fix RLS Security Issues
-- This script enables Row Level Security on tables that are missing it
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on telegram_config table
ALTER TABLE public.telegram_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy for telegram_config (admin only)
CREATE POLICY "Admin only access to telegram_config" ON public.telegram_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 2. Enable RLS on telegram_auth_requests table
ALTER TABLE public.telegram_auth_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy for telegram_auth_requests (admin only)
CREATE POLICY "Admin only access to telegram_auth_requests" ON public.telegram_auth_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 3. Enable RLS on follow_up_chiamate table
ALTER TABLE public.follow_up_chiamate ENABLE ROW LEVEL SECURITY;

-- RLS Policy for follow_up_chiamate (authenticated users only)
CREATE POLICY "Authenticated users can access follow_up_chiamate" ON public.follow_up_chiamate
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Enable RLS on statistiche_follow_up table
ALTER TABLE public.statistiche_follow_up ENABLE ROW LEVEL SECURITY;

-- RLS Policy for statistiche_follow_up (authenticated users only)
CREATE POLICY "Authenticated users can access statistiche_follow_up" ON public.statistiche_follow_up
    FOR ALL USING (auth.role() = 'authenticated');

-- Verify RLS is enabled (optional check queries)
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('telegram_config', 'telegram_auth_requests', 'follow_up_chiamate', 'statistiche_follow_up');