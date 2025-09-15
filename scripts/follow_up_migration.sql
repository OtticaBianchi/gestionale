-- Migration per sistema follow-up chiamate
-- Data: 2025-09-14

BEGIN;

-- 1. Aggiungere campo primo_acquisto_lac alla tabella materiali
ALTER TABLE materiali
ADD COLUMN primo_acquisto_lac BOOLEAN DEFAULT FALSE;

-- 2. Creare tabella per tracking chiamate follow-up
CREATE TABLE follow_up_chiamate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  busta_id UUID NOT NULL REFERENCES buste(id) ON DELETE CASCADE,
  data_generazione DATE NOT NULL DEFAULT CURRENT_DATE,
  data_chiamata TIMESTAMP,
  operatore_id UUID REFERENCES profiles(id),

  -- Stati chiamata
  stato_chiamata TEXT NOT NULL DEFAULT 'da_chiamare' CHECK (stato_chiamata IN (
    'da_chiamare',
    'chiamato_completato',
    'non_vuole_essere_contattato',
    'non_risponde',
    'cellulare_staccato',
    'numero_sbagliato',
    'richiamami'
  )),

  -- Livello soddisfazione (solo se chiamato_completato)
  livello_soddisfazione TEXT CHECK (livello_soddisfazione IN (
    'molto_soddisfatto',
    'soddisfatto',
    'poco_soddisfatto',
    'insoddisfatto'
  )),

  -- Note libere operatore
  note_chiamata TEXT,

  -- Orario per richiamata (solo se richiamami)
  orario_richiamata_da TIME,
  orario_richiamata_a TIME,

  -- Tracking per archiviazione automatica
  data_completamento DATE,
  archiviato BOOLEAN DEFAULT FALSE,

  -- Priorità calcolata al momento della generazione
  priorita TEXT NOT NULL CHECK (priorita IN ('alta', 'normale', 'bassa')),

  -- Timestamp standard
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Creare tabella per statistiche giornaliere
CREATE TABLE statistiche_follow_up (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_riferimento DATE NOT NULL DEFAULT CURRENT_DATE,
  operatore_id UUID REFERENCES profiles(id),

  -- Contatori chiamate
  chiamate_totali INTEGER DEFAULT 0,
  chiamate_completate INTEGER DEFAULT 0,

  -- Soddisfazione
  molto_soddisfatti INTEGER DEFAULT 0,
  soddisfatti INTEGER DEFAULT 0,
  poco_soddisfatti INTEGER DEFAULT 0,
  insoddisfatti INTEGER DEFAULT 0,

  -- Stati problematici
  non_vuole_contatto INTEGER DEFAULT 0,
  numeri_sbagliati INTEGER DEFAULT 0,
  cellulari_staccati INTEGER DEFAULT 0,
  non_risponde INTEGER DEFAULT 0,
  da_richiamare INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraint per evitare duplicati per operatore/data
  UNIQUE(data_riferimento, operatore_id)
);

-- 4. Indici per performance
CREATE INDEX idx_follow_up_busta_id ON follow_up_chiamate(busta_id);
CREATE INDEX idx_follow_up_data_generazione ON follow_up_chiamate(data_generazione);
CREATE INDEX idx_follow_up_stato ON follow_up_chiamate(stato_chiamata);
CREATE INDEX idx_follow_up_archiviato ON follow_up_chiamate(archiviato);
CREATE INDEX idx_follow_up_priorita ON follow_up_chiamate(priorita);

CREATE INDEX idx_statistiche_data ON statistiche_follow_up(data_riferimento);
CREATE INDEX idx_statistiche_operatore ON statistiche_follow_up(operatore_id);

-- 5. Trigger per aggiornamento automatico updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_follow_up_chiamate_updated_at
    BEFORE UPDATE ON follow_up_chiamate
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Trigger per aggiornamento statistiche in tempo reale
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
            AND stato_chiamata IN ('chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato', 'cellulare_staccato')
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
        cellulari_staccati = (
            SELECT COUNT(*) FROM follow_up_chiamate
            WHERE operatore_id = operatore AND data_generazione = data_ref
            AND stato_chiamata = 'cellulare_staccato'
        ),
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

CREATE TRIGGER trigger_aggiorna_statistiche_follow_up
    AFTER INSERT OR UPDATE ON follow_up_chiamate
    FOR EACH ROW EXECUTE FUNCTION aggiorna_statistiche_follow_up();

-- 7. Funzione per calcolo priorità
CREATE OR REPLACE FUNCTION calcola_priorita_follow_up(
    prezzo_finale DECIMAL,
    tipo_lavorazione TEXT,
    ha_primo_acquisto_lac BOOLEAN
) RETURNS TEXT AS $$
BEGIN
    -- PRIORITÀ ALTA: Lenti + Occhiali sopra 400€
    IF prezzo_finale >= 400 AND tipo_lavorazione IN ('OCV', 'OV') THEN
        RETURN 'alta';
    END IF;

    -- PRIORITÀ NORMALE: Prime LAC o Lenti da vista sopra 100€
    IF ha_primo_acquisto_lac OR (prezzo_finale >= 100 AND tipo_lavorazione = 'LV') THEN
        RETURN 'normale';
    END IF;

    -- PRIORITÀ BASSA: Occhiali da sole sopra 400€
    IF prezzo_finale >= 400 AND tipo_lavorazione = 'OS' THEN
        RETURN 'bassa';
    END IF;

    -- Non gestito da questo sistema
    RETURN NULL;
END;
$$ language 'plpgsql';

-- 8. Funzione per archiviazione automatica (da chiamare con cron job)
CREATE OR REPLACE FUNCTION archivia_chiamate_completate()
RETURNS INTEGER AS $$
DECLARE
    rows_archived INTEGER;
BEGIN
    UPDATE follow_up_chiamate
    SET archiviato = TRUE
    WHERE archiviato = FALSE
    AND data_completamento IS NOT NULL
    AND data_completamento < CURRENT_DATE - INTERVAL '3 days';

    GET DIAGNOSTICS rows_archived = ROW_COUNT;
    RETURN rows_archived;
END;
$$ language 'plpgsql';

-- Aggiungi commenti alle tabelle
COMMENT ON TABLE follow_up_chiamate IS 'Tracking chiamate di follow-up post-vendita per soddisfazione clienti';
COMMENT ON TABLE statistiche_follow_up IS 'Statistiche giornaliere performance follow-up per operatore';
COMMENT ON COLUMN materiali.primo_acquisto_lac IS 'Flag per identificare primo acquisto lenti a contatto';

COMMIT;