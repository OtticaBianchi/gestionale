-- TEST ROLE-BASED ACCESS AFTER RLS MIGRATION
-- Run this script with different user roles to verify access levels work correctly

-- ================================
-- ROLE ACCESS VERIFICATION TESTS
-- ================================

-- First, check which role the current user has
SELECT 
    'Current user role check' as test,
    p.id,
    p.full_name,
    p.role,
    p.email
FROM profiles p
WHERE p.id = auth.uid();

-- ================================
-- TEST AS OPERATORE (READ-ONLY)
-- ================================
-- Expected: Can read all data, cannot create/modify anything

-- Should work: Read all buste
SELECT 
    'Operatore buste access' as test,
    COUNT(*) as total_buste
FROM buste;

-- Should work: Read all communications  
SELECT 
    'Operatore comunicazioni access' as test,
    COUNT(*) as total_communications
FROM comunicazioni;

-- Should work: Read all payment info
SELECT 
    'Operatore payment access' as test,
    COUNT(*) as total_payments
FROM info_pagamenti;

-- Should work: Read all material orders
SELECT 
    'Operatore orders access' as test,
    COUNT(*) as total_orders
FROM ordini_materiali;

-- Should FAIL if user is operatore: Try to create a communication
-- Uncomment to test (should get permission denied):
/*
INSERT INTO comunicazioni (busta_id, messaggio, tipo_messaggio)
VALUES ('some-busta-id', 'Test message', 'nota_comunicazione_cliente');
*/

-- ================================
-- TEST AS MANAGER (OWN DATA ONLY)
-- ================================
-- Expected: Can see all data, can only modify own buste and related data

-- Should work: Read all buste
SELECT 
    'Manager buste access' as test,
    COUNT(*) as total_buste_visible,
    COUNT(CASE WHEN creato_da = auth.uid() THEN 1 END) as own_buste
FROM buste;

-- Should work: Read communications for own buste only (with current policy)
SELECT 
    'Manager comunicazioni access' as test,
    COUNT(*) as accessible_communications
FROM comunicazioni c
JOIN buste b ON b.id = c.busta_id;

-- Should work: Create communication for own busta (if manager)
-- Uncomment to test with real busta_id that manager created:
/*
INSERT INTO comunicazioni (busta_id, messaggio, tipo_messaggio)
VALUES ('manager-owned-busta-id', 'Test manager message', 'nota_comunicazione_cliente');
*/

-- Should FAIL if trying to modify other manager's data:
-- Uncomment to test with busta_id created by different manager:
/*
INSERT INTO comunicazioni (busta_id, messaggio, tipo_messaggio)
VALUES ('other-manager-busta-id', 'Should fail', 'nota_comunicazione_cliente');
*/

-- ================================
-- TEST AS ADMIN (FULL ACCESS)  
-- ================================
-- Expected: Can do everything on all data

-- Should work: See all profiles
SELECT 
    'Admin profiles access' as test,
    COUNT(*) as total_profiles
FROM profiles;

-- Should work: See all data across all tables
SELECT 
    'Admin full data access' as test,
    (SELECT COUNT(*) FROM buste) as buste_count,
    (SELECT COUNT(*) FROM comunicazioni) as communications_count,
    (SELECT COUNT(*) FROM info_pagamenti) as payments_count,
    (SELECT COUNT(*) FROM ordini_materiali) as orders_count;

-- Should work: Modify any data (test with caution)
-- Uncomment to test updating another user's busta:
/*
UPDATE buste 
SET note_interne = 'Admin test modification'
WHERE id = 'any-busta-id'
LIMIT 1;
*/

-- ================================
-- SECURITY BOUNDARY TESTS
-- ================================

-- Test 1: Users should only see their own profile details (except admin)
SELECT 
    'Profile visibility test' as test,
    CASE 
        WHEN COUNT(*) = 1 AND MAX(id) = auth.uid() THEN 'PASS: Non-admin sees only own profile'
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' AND COUNT(*) > 1 THEN 'PASS: Admin sees all profiles'
        ELSE 'FAIL: Incorrect profile visibility'
    END as result
FROM profiles;

-- Test 2: Cross-creator data access based on role
SELECT 
    'Cross-creator access test' as test,
    current_user_role.role,
    CASE 
        WHEN current_user_role.role = 'admin' THEN 'Should see all creators data'
        WHEN current_user_role.role = 'manager' THEN 'Should see own + readable data'  
        WHEN current_user_role.role = 'operatore' THEN 'Should see all data (read-only)'
        ELSE 'Unknown role'
    END as expected_access,
    COUNT(DISTINCT b.creato_da) as visible_creators
FROM buste b
CROSS JOIN (
    SELECT role FROM profiles WHERE id = auth.uid()
) as current_user_role
GROUP BY current_user_role.role;

-- ================================
-- EXPECTED RESULTS BY ROLE
-- ================================

-- OPERATORE:
-- ✅ Can read all buste, comunicazioni, payments, orders
-- ✅ Cannot insert/update/delete anything
-- ✅ Sees only own profile
-- ✅ Cross-creator test shows multiple creators (read access)

-- MANAGER:
-- ✅ Can read all data
-- ✅ Can insert/update data for own buste only
-- ✅ Cannot modify other managers' data
-- ✅ Sees only own profile
-- ✅ Cross-creator test shows own + readable data

-- ADMIN:
-- ✅ Can read/write all data
-- ✅ Can modify any user's data
-- ✅ Sees all profiles
-- ✅ Can perform user management functions
-- ✅ Cross-creator test shows all creators

-- If any test fails, check the corresponding policy fix script