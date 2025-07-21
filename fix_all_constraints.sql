-- Script per sistemare TUTTI i constraint delle comunicazioni
-- Da eseguire in Supabase SQL Editor

-- 1. FIX canale_invio constraint (aggiungi 'altro')
ALTER TABLE comunicazioni DROP CONSTRAINT IF EXISTS comunicazioni_canale_invio_check;
ALTER TABLE comunicazioni ADD CONSTRAINT comunicazioni_canale_invio_check 
CHECK (canale_invio IN ('sms', 'whatsapp', 'email', 'altro'));

-- 2. FIX destinatario_tipo constraint (aggiungi 'interno')
ALTER TABLE comunicazioni DROP CONSTRAINT IF EXISTS comunicazioni_destinatario_tipo_check;
ALTER TABLE comunicazioni ADD CONSTRAINT comunicazioni_destinatario_tipo_check 
CHECK (destinatario_tipo IN ('cliente', 'interno'));

-- 3. Verifica che funzioni tutto
SELECT 'Tutti i constraint aggiornati!' as status;

-- 4. Mostra i constraint aggiornati
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'comunicazioni'::regclass 
AND contype = 'c'  -- check constraints
AND conname LIKE '%comunicazioni%'
ORDER BY conname;