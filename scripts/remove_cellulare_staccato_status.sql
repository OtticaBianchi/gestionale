-- Migration to remove cellulare_staccato status from follow-up system
-- Data: 2025-09-27

BEGIN;

-- 1. Update the check constraint to remove cellulare_staccato
ALTER TABLE follow_up_chiamate DROP CONSTRAINT IF EXISTS follow_up_chiamate_stato_chiamata_check;

ALTER TABLE follow_up_chiamate ADD CONSTRAINT follow_up_chiamate_stato_chiamata_check
CHECK (stato_chiamata IN (
  'da_chiamare',
  'chiamato_completato',
  'non_vuole_essere_contattato',
  'non_risponde',
  'numero_sbagliato',
  'richiamami'
));

-- 2. Update any existing cellulare_staccato records to non_risponde
UPDATE follow_up_chiamate
SET stato_chiamata = 'non_risponde'
WHERE stato_chiamata = 'cellulare_staccato';

-- 3. Update the trigger function to exclude cellulare_staccato counts
CREATE OR REPLACE FUNCTION aggiorna_statistiche_follow_up()
RETURNS TRIGGER AS $$
DECLARE
    operatore UUID;
    data_ref DATE;
BEGIN
    -- Determina operatore e data di riferimento
    IF TG_OP = 'INSERT' THEN
        operatore := NEW.operatore_id;
        data_ref := NEW.data_generazione;
    ELSIF TG_OP = 'UPDATE' THEN
        operatore := NEW.operatore_id;
        data_ref := NEW.data_generazione;
    END IF;

    -- Se non c'è operatore, salta l'aggiornamento
    IF operatore IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Inserisci record statistiche se non esiste
    INSERT INTO statistiche_follow_up (data_riferimento, operatore_id)
    VALUES (data_ref, operatore)
    ON CONFLICT (data_riferimento, operatore_id) DO NOTHING;

    -- Ricalcola tutte le statistiche per l'operatore/data
    UPDATE statistiche_follow_up SET
        chiamate_totali = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
        ),
        chiamate_completate = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata IN ('chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato')
        ),
        molto_soddisfatti = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND livello_soddisfazione = 'molto_soddisfatto'
        ),
        soddisfatti = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND livello_soddisfazione = 'soddisfatto'
        ),
        poco_soddisfatti = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND livello_soddisfazione = 'poco_soddisfatto'
        ),
        insoddisfatti = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND livello_soddisfazione = 'insoddisfatto'
        ),
        non_vuole_contatto = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata = 'non_vuole_essere_contattato'
        ),
        numeri_sbagliati = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata = 'numero_sbagliato'
        ),
        cellulari_staccati = 0, -- Deprecated: now merged with non_risponde
        non_risponde = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata = 'non_risponde'
        ),
        da_richiamare = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata = 'richiamami'
        )
    WHERE data_riferimento = data_ref AND operatore_id = operatore;

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- 4. Add comment about the change
COMMENT ON COLUMN statistiche_follow_up.cellulari_staccati IS 'Deprecated: cellulare_staccato status merged with non_risponde';

COMMIT;