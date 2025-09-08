-- CHECK ORDINI_MATERIALI TABLE STRUCTURE
-- Need to verify correct column names before fixing policies

-- STEP 1: Get all columns for ordini_materiali table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'ordini_materiali'
ORDER BY ordinal_position;

-- STEP 2: Check existing policies to see what columns they reference
SELECT 
    policyname,
    cmd,
    qual as using_condition
FROM pg_policies 
WHERE tablename = 'ordini_materiali';

-- STEP 3: Sample a few rows to understand the structure
SELECT * FROM ordini_materiali LIMIT 3;