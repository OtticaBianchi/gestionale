-- RLS Testing Queries
-- Use these to validate RLS behavior before and after enabling

-- CRITICAL: Run these as different users to test isolation

-- Test 1: Profiles table access
-- Should return only current user's profile when RLS enabled
SELECT 
    'profiles_test' as test_name,
    id,
    full_name,
    role,
    company_id
FROM profiles 
WHERE id = auth.uid();

-- Test 2: Check if admin can see all profiles (should break with RLS)
SELECT 
    'admin_profiles_test' as test_name,
    COUNT(*) as total_profiles
FROM profiles;

-- Test 3: Company-based data access (comunicazioni)
-- Test if company filtering works correctly
SELECT 
    'comunicazioni_test' as test_name,
    id,
    titolo,
    created_at
FROM comunicazioni
LIMIT 5;

-- Test 4: Material access (check if users can access materials)
SELECT 
    'materiali_test' as test_name,
    id,
    nome,
    descrizione
FROM materiali
LIMIT 5;

-- Test 5: Lavorazioni access
SELECT 
    'lavorazioni_test' as test_name,
    id,
    busta_id,
    responsabile_id
FROM lavorazioni
LIMIT 5;

-- Test 6: Payment info access
SELECT 
    'payment_info_test' as test_name,
    id,
    importo_totale
FROM info_pagamenti
LIMIT 5;

-- Test 7: Orders access
SELECT 
    'orders_test' as test_name,
    id,
    materiale_id,
    quantita
FROM ordini_materiali
LIMIT 5;

-- Test 8: Reference data access
SELECT 
    'reference_data_test' as test_name,
    id,
    nome
FROM tipi_montaggio
LIMIT 5;

-- Test 9: Views access (these might break)
SELECT 
    'view_test_1' as test_name,
    COUNT(*) as count
FROM v_ordini_materiali_completi;

SELECT 
    'view_test_2' as test_name,
    COUNT(*) as count
FROM v_ordini_materiali_con_fornitori;