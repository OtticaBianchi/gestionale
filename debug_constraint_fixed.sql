-- Script per diagnosticare il problema constraint canale_invio (VERSIONE CORRETTA)
-- Da eseguire in Supabase SQL Editor

-- 1. Verifica i constraint esistenti sulla tabella comunicazioni (versione corretta)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'comunicazioni'::regclass 
AND contype = 'c'  -- check constraints
ORDER BY conname;

-- 2. Verifica la struttura della colonna canale_invio
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'comunicazioni' 
AND column_name = 'canale_invio';

-- 3. Verifica i valori esistenti in canale_invio
SELECT DISTINCT canale_invio 
FROM comunicazioni 
WHERE canale_invio IS NOT NULL
ORDER BY canale_invio;

-- 4. Verifica se il nostro constraint esiste davvero
SELECT EXISTS(
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comunicazioni_canale_invio_check'
    AND conrelid = 'comunicazioni'::regclass
) as constraint_exists;

SELECT 'Debug completato. Controlla i risultati sopra.' as status;