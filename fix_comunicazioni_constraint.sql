-- Script per aggiungere "altro" al constraint canale_invio
-- Da eseguire in Supabase SQL Editor

-- Rimuovi il constraint esistente
ALTER TABLE comunicazioni DROP CONSTRAINT IF EXISTS comunicazioni_canale_invio_check;

-- Aggiungi il nuovo constraint con "altro" incluso
ALTER TABLE comunicazioni ADD CONSTRAINT comunicazioni_canale_invio_check 
CHECK (canale_invio IN ('sms', 'whatsapp', 'email', 'altro'));

SELECT 'Constraint aggiornato! Ora "altro" è permesso per canale_invio.' as status;