-- =====================================================
-- FIX DATABASE SCHEMA - Correzioni e Miglioramenti
-- =====================================================

-- 1. CORREGGERE IL CHECK CONSTRAINT di categoria_fornitore
-- Aggiungere 'laboratorio' mancante
ALTER TABLE public.ordini_materiali 
DROP CONSTRAINT IF EXISTS ordini_materiali_categoria_fornitore_check;

ALTER TABLE public.ordini_materiali 
ADD CONSTRAINT ordini_materiali_categoria_fornitore_check 
CHECK (categoria_fornitore = ANY (ARRAY['lenti'::text, 'lac'::text, 'montature'::text, 'sport'::text, 'laboratorio'::text]));

-- 2. AGGIUNGERE FOREIGN KEY MANCANTE per fornitore_id in materiali
-- Attualmente fornitore_id in materiali non punta a nessuna tabella
-- Commentato perché non è chiaro a quale tabella dovrebbe puntare
-- ALTER TABLE public.materiali 
-- ADD CONSTRAINT materiali_fornitore_id_fkey 
-- FOREIGN KEY (fornitore_id) REFERENCES public.fornitori_????(id);

-- 3. AGGIUNGERE INDICI per migliorare le performance delle ricerche
CREATE INDEX IF NOT EXISTS idx_ordini_materiali_fornitore_lenti 
ON public.ordini_materiali (fornitore_lenti_id) WHERE fornitore_lenti_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_materiali_fornitore_lac 
ON public.ordini_materiali (fornitore_lac_id) WHERE fornitore_lac_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_materiali_fornitore_montature 
ON public.ordini_materiali (fornitore_montature_id) WHERE fornitore_montature_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_materiali_fornitore_sport 
ON public.ordini_materiali (fornitore_sport_id) WHERE fornitore_sport_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordini_materiali_fornitore_lab_esterno 
ON public.ordini_materiali (fornitore_lab_esterno_id) WHERE fornitore_lab_esterno_id IS NOT NULL;

-- 4. INDICI per le ricerche testuali
CREATE INDEX IF NOT EXISTS idx_fornitori_lenti_nome_gin 
ON public.fornitori_lenti USING gin(to_tsvector('italian', nome));

CREATE INDEX IF NOT EXISTS idx_fornitori_lac_nome_gin 
ON public.fornitori_lac USING gin(to_tsvector('italian', nome));

CREATE INDEX IF NOT EXISTS idx_fornitori_montature_nome_gin 
ON public.fornitori_montature USING gin(to_tsvector('italian', nome));

CREATE INDEX IF NOT EXISTS idx_fornitori_sport_nome_gin 
ON public.fornitori_sport USING gin(to_tsvector('italian', nome));

CREATE INDEX IF NOT EXISTS idx_fornitori_lab_esterno_nome_gin 
ON public.fornitori_lab_esterno USING gin(to_tsvector('italian', nome));

-- 5. INDICI per le ricerche nelle descrizioni prodotti
CREATE INDEX IF NOT EXISTS idx_ordini_materiali_descrizione_gin 
ON public.ordini_materiali USING gin(to_tsvector('italian', descrizione_prodotto));

CREATE INDEX IF NOT EXISTS idx_materiali_fornitore_gin 
ON public.materiali USING gin(to_tsvector('italian', fornitore)) 
WHERE fornitore IS NOT NULL;

-- 6. INDICI per le ricerche sui clienti
CREATE INDEX IF NOT EXISTS idx_clienti_nome_cognome_gin 
ON public.clienti USING gin(to_tsvector('italian', nome || ' ' || cognome));

-- 7. AGGIUNGERE CONSTRAINT per evitare multiple FK nella stessa riga
-- Un ordine dovrebbe avere solo un fornitore di una categoria
ALTER TABLE public.ordini_materiali 
ADD CONSTRAINT check_single_fornitore 
CHECK (
  (
    (fornitore_lenti_id IS NOT NULL)::int + 
    (fornitore_lac_id IS NOT NULL)::int + 
    (fornitore_montature_id IS NOT NULL)::int + 
    (fornitore_sport_id IS NOT NULL)::int + 
    (fornitore_lab_esterno_id IS NOT NULL)::int
  ) <= 1
);

-- 8. TRIGGER per aggiornare automaticamente categoria_fornitore
CREATE OR REPLACE FUNCTION update_categoria_fornitore()
RETURNS TRIGGER AS $$
BEGIN
  -- Imposta automaticamente categoria_fornitore basato sui FK
  IF NEW.fornitore_lenti_id IS NOT NULL THEN
    NEW.categoria_fornitore = 'lenti';
  ELSIF NEW.fornitore_lac_id IS NOT NULL THEN
    NEW.categoria_fornitore = 'lac';
  ELSIF NEW.fornitore_montature_id IS NOT NULL THEN
    NEW.categoria_fornitore = 'montature';
  ELSIF NEW.fornitore_sport_id IS NOT NULL THEN
    NEW.categoria_fornitore = 'sport';
  ELSIF NEW.fornitore_lab_esterno_id IS NOT NULL THEN
    NEW.categoria_fornitore = 'laboratorio';
  ELSE
    NEW.categoria_fornitore = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_categoria_fornitore
  BEFORE INSERT OR UPDATE ON public.ordini_materiali
  FOR EACH ROW
  EXECUTE FUNCTION update_categoria_fornitore();

-- 9. AGGIORNARE categoria_fornitore per i record esistenti
UPDATE public.ordini_materiali 
SET categoria_fornitore = 'lenti' 
WHERE fornitore_lenti_id IS NOT NULL AND categoria_fornitore IS DISTINCT FROM 'lenti';

UPDATE public.ordini_materiali 
SET categoria_fornitore = 'lac' 
WHERE fornitore_lac_id IS NOT NULL AND categoria_fornitore IS DISTINCT FROM 'lac';

UPDATE public.ordini_materiali 
SET categoria_fornitore = 'montature' 
WHERE fornitore_montature_id IS NOT NULL AND categoria_fornitore IS DISTINCT FROM 'montature';

UPDATE public.ordini_materiali 
SET categoria_fornitore = 'sport' 
WHERE fornitore_sport_id IS NOT NULL AND categoria_fornitore IS DISTINCT FROM 'sport';

UPDATE public.ordini_materiali 
SET categoria_fornitore = 'laboratorio' 
WHERE fornitore_lab_esterno_id IS NOT NULL AND categoria_fornitore IS DISTINCT FROM 'laboratorio';

-- 10. AGGIUNGERE CONSTRAINT per coerenza updated_at
ALTER TABLE public.buste 
ADD CONSTRAINT check_updated_at_after_created 
CHECK (updated_at >= data_apertura);

-- 11. MIGLIORARE I DEFAULT VALUES
ALTER TABLE public.ordini_materiali 
ALTER COLUMN updated_at SET DEFAULT now();

-- =====================================================
-- COMMENTI E NOTE
-- =====================================================

-- PROBLEMA IDENTIFICATO: fornitore_id in materiali
-- La colonna fornitore_id nella tabella materiali non ha FK constraint.
-- Questo suggerisce che potrebbe essere un campo generico o non utilizzato.
-- RACCOMANDAZIONE: Verificare se questa colonna è utilizzata e decidere:
--   1. Eliminarla se non serve
--   2. Creare una tabella fornitori_generici
--   3. Usare solo il campo fornitore (text) per brand generici

-- MIGLIORAMENTO SUGGERITO: View per semplificare le query
CREATE OR REPLACE VIEW v_ordini_materiali_con_fornitori AS
SELECT 
  om.*,
  COALESCE(fl.nome, flac.nome, fm.nome, fs.nome, flab.nome) AS nome_fornitore,
  COALESCE(fl.telefono, flac.telefono, fm.telefono, fs.telefono, flab.telefono) AS telefono_fornitore,
  COALESCE(fl.email, flac.email, fm.email, fs.email, flab.email) AS email_fornitore,
  COALESCE(fl.tempi_consegna_medi, flac.tempi_consegna_medi, fm.tempi_consegna_medi, fs.tempi_consegna_medi, flab.tempi_consegna_medi) AS tempi_consegna_fornitore
FROM public.ordini_materiali om
LEFT JOIN public.fornitori_lenti fl ON om.fornitore_lenti_id = fl.id
LEFT JOIN public.fornitori_lac flac ON om.fornitore_lac_id = flac.id  
LEFT JOIN public.fornitori_montature fm ON om.fornitore_montature_id = fm.id
LEFT JOIN public.fornitori_sport fs ON om.fornitore_sport_id = fs.id
LEFT JOIN public.fornitori_lab_esterno flab ON om.fornitore_lab_esterno_id = flab.id;

-- =====================================================
-- SCRIPT COMPLETATO
-- =====================================================
-- Eseguire questo script in Supabase SQL Editor
-- Controllare che tutte le query eseguano senza errori
-- Testare le ricerche dopo l'applicazione delle modifiche