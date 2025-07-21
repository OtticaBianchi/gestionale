-- Script per aggiungere i campi pricing al database
-- Da eseguire in Supabase SQL Editor

-- 1. Aggiungi campi alla tabella info_pagamenti
ALTER TABLE info_pagamenti 
ADD COLUMN IF NOT EXISTS importo_acconto DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS prezzo_finale DECIMAL(10,2);

-- 2. Aggiungi campo importo_rata alla tabella rate_pagamenti  
ALTER TABLE rate_pagamenti
ADD COLUMN IF NOT EXISTS importo_rata DECIMAL(10,2);

-- 3. Commenti per documentazione
COMMENT ON COLUMN info_pagamenti.importo_acconto IS 'Importo dell''acconto versato dal cliente';
COMMENT ON COLUMN info_pagamenti.prezzo_finale IS 'Prezzo finale totale del lavoro (per reportistica)';
COMMENT ON COLUMN rate_pagamenti.importo_rata IS 'Importo della singola rata di pagamento';

-- 4. Aggiorna policy RLS se necessario (mantiene le policy esistenti)
-- Le policy esistenti dovrebbero già coprire questi nuovi campi

SELECT 'Script completato! Nuovi campi aggiunti alle tabelle.' as status;