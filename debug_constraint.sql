-- Script per diagnosticare il problema constraint canale_invio
-- Da eseguire in Supabase SQL Editor

-- 1. Verifica i constraint esistenti sulla tabella comunicazioni
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
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

-- 4. Test: Prova a inserire un record con 'altro'
-- (commentato per sicurezza, rimuovi -- per testare)
-- INSERT INTO comunicazioni (
--     busta_id, tipo_messaggio, testo_messaggio, data_invio,
--     destinatario_tipo, destinatario_nome, destinatario_contatto,
--     canale_invio, stato_invio, inviato_da, nome_operatore
-- ) VALUES (
--     '00000000-0000-0000-0000-000000000000', 'test', 'test message', NOW(),
--     'interno', 'Test', '1234567890',
--     'altro', 'test', '00000000-0000-0000-0000-000000000000', 'Test User'
-- );

SELECT 'Debug completato. Controlla i risultati sopra.' as status;