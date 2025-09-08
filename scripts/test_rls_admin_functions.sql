-- TEST RLS ADMIN FUNCTIONS AFTER MIGRATION
-- Run this as an admin user to verify all functions work correctly
-- This script tests the most critical admin functions that were previously broken

-- PREREQUISITES:
-- 1. All policy fix scripts have been executed
-- 2. RLS has been enabled on all 5 tables
-- 3. You are logged in as a user with role = 'admin'

-- ================================
-- TEST 1: PROFILES ADMIN FUNCTIONS
-- ================================

-- This should show ALL user profiles (previously failed with old policy)
SELECT 
    id,
    full_name,
    email,
    role,
    created_at
FROM profiles 
ORDER BY created_at;

-- This should work: Admin changing another user's role
-- Replace 'target-user-id' with actual user ID
/*
UPDATE profiles 
SET role = 'manager' 
WHERE id = 'target-user-id';
*/

-- Verify the role change worked
/*
SELECT id, full_name, role 
FROM profiles 
WHERE id = 'target-user-id';
*/

-- ================================
-- TEST 2: BUSTA-RELATED DATA ACCESS
-- ================================

-- Admin should see ALL communications (previously failed)
SELECT 
    c.id,
    c.busta_id,
    c.messaggio,
    c.tipo_messaggio,
    b.creato_da as busta_creator
FROM comunicazioni c
JOIN buste b ON b.id = c.busta_id
ORDER BY c.created_at DESC
LIMIT 5;

-- Admin should see ALL payment installments
SELECT 
    r.id,
    r.busta_id,
    r.numero_rata,
    r.importo,
    b.creato_da as busta_creator
FROM rate_pagamenti r
JOIN buste b ON b.id = r.busta_id
ORDER BY r.data_scadenza DESC
LIMIT 5;

-- Admin should see ALL payment info
SELECT 
    i.id,
    i.busta_id,
    i.metodo_pagamento,
    i.stato_pagamento,
    b.creato_da as busta_creator
FROM info_pagamenti i
JOIN buste b ON b.id = i.busta_id
ORDER BY i.updated_at DESC
LIMIT 5;

-- Admin should see ALL material orders
SELECT 
    o.id,
    o.lavorazione_id,
    o.materiale_id,
    o.quantita,
    l.busta_id
FROM ordini_materiali o
JOIN lavorazioni l ON l.id = o.lavorazione_id
ORDER BY o.created_at DESC
LIMIT 5;

-- ================================
-- TEST 3: CROSS-MANAGER OPERATIONS
-- ================================

-- Admin should be able to work on buste created by different managers
-- This query should show buste from multiple creators
SELECT 
    b.id,
    b.numero_busta,
    b.stato_attuale,
    p.full_name as creator_name,
    p.role as creator_role
FROM buste b
JOIN profiles p ON p.id = b.creato_da
ORDER BY b.created_at DESC
LIMIT 10;

-- ================================
-- TEST 4: ROLE-BASED PERMISSIONS
-- ================================

-- Check that our role system is working correctly
SELECT 
    'Admin user check' as test,
    p.id,
    p.full_name,
    p.role
FROM profiles p
WHERE p.id = auth.uid();

-- Verify admin can see data from different creators
SELECT 
    'Cross-manager visibility' as test,
    COUNT(DISTINCT b.creato_da) as different_creators,
    COUNT(*) as total_buste_visible
FROM buste b;

-- ================================
-- TEST 5: EMERGENCY FUNCTIONS
-- ================================

-- Admin should be able to delete any communication (if needed)
-- CAREFUL: Only uncomment if you need to test deletion
/*
DELETE FROM comunicazioni 
WHERE id = 'test-communication-id';
*/

-- Admin should be able to delete any payment installment (if needed)
-- CAREFUL: Only uncomment if you need to test deletion
/*
DELETE FROM rate_pagamenti 
WHERE id = 'test-payment-id';
*/

-- ================================
-- SUCCESS CRITERIA
-- ================================
-- ✅ All SELECT queries return data (no permission denied errors)
-- ✅ UPDATE queries work on other users' data
-- ✅ Admin sees data from multiple creators/managers
-- ✅ Role check shows current user as 'admin'
-- ✅ Cross-manager visibility count > 1 creator

-- If any query fails with permission denied, the policies need adjustment