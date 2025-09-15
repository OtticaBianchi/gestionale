const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role per DDL

async function executeMigration() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variabili ambiente mancanti!');
    console.log('SUPABASE_URL:', !!supabaseUrl);
    console.log('SERVICE_KEY:', !!supabaseServiceKey);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Avvio migrazione follow-up...\n');

  try {
    // Step 1: Aggiungere campo primo_acquisto_lac a materiali
    console.log('1️⃣ Aggiungendo campo primo_acquisto_lac...');

    const { error: alterError } = await supabase.rpc('sql', {
      query: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'materiali' AND column_name = 'primo_acquisto_lac'
          ) THEN
            ALTER TABLE materiali ADD COLUMN primo_acquisto_lac BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Campo primo_acquisto_lac aggiunto con successo';
          ELSE
            RAISE NOTICE 'Campo primo_acquisto_lac già esiste';
          END IF;
        END $$;
      `
    });

    if (alterError) {
      console.error('❌ Errore aggiunta campo:', alterError);
    } else {
      console.log('✅ Campo primo_acquisto_lac aggiunto\n');
    }

    // Step 2: Creare tabella follow_up_chiamate
    console.log('2️⃣ Creando tabella follow_up_chiamate...');

    const { error: tableError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS follow_up_chiamate (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          busta_id UUID NOT NULL REFERENCES buste(id) ON DELETE CASCADE,
          data_generazione DATE NOT NULL DEFAULT CURRENT_DATE,
          data_chiamata TIMESTAMP,
          operatore_id UUID REFERENCES profiles(id),
          stato_chiamata TEXT NOT NULL DEFAULT 'da_chiamare' CHECK (stato_chiamata IN (
            'da_chiamare',
            'chiamato_completato',
            'non_vuole_essere_contattato',
            'non_risponde',
            'cellulare_staccato',
            'numero_sbagliato',
            'richiamami'
          )),
          livello_soddisfazione TEXT CHECK (livello_soddisfazione IN (
            'molto_soddisfatto',
            'soddisfatto',
            'poco_soddisfatto',
            'insoddisfatto'
          )),
          note_chiamata TEXT,
          orario_richiamata_da TIME,
          orario_richiamata_a TIME,
          data_completamento DATE,
          archiviato BOOLEAN DEFAULT FALSE,
          priorita TEXT NOT NULL CHECK (priorita IN ('alta', 'normale', 'bassa')),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (tableError) {
      console.error('❌ Errore creazione tabella follow_up_chiamate:', tableError);
    } else {
      console.log('✅ Tabella follow_up_chiamate creata\n');
    }

    // Step 3: Creare tabella statistiche
    console.log('3️⃣ Creando tabella statistiche_follow_up...');

    const { error: statsError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS statistiche_follow_up (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data_riferimento DATE NOT NULL DEFAULT CURRENT_DATE,
          operatore_id UUID REFERENCES profiles(id),
          chiamate_totali INTEGER DEFAULT 0,
          chiamate_completate INTEGER DEFAULT 0,
          molto_soddisfatti INTEGER DEFAULT 0,
          soddisfatti INTEGER DEFAULT 0,
          poco_soddisfatti INTEGER DEFAULT 0,
          insoddisfatti INTEGER DEFAULT 0,
          non_vuole_contatto INTEGER DEFAULT 0,
          numeri_sbagliati INTEGER DEFAULT 0,
          cellulari_staccati INTEGER DEFAULT 0,
          non_risponde INTEGER DEFAULT 0,
          da_richiamare INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(data_riferimento, operatore_id)
        );
      `
    });

    if (statsError) {
      console.error('❌ Errore creazione tabella statistiche:', statsError);
    } else {
      console.log('✅ Tabella statistiche_follow_up creata\n');
    }

    // Step 4: Creare indici
    console.log('4️⃣ Creando indici...');

    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_follow_up_busta_id ON follow_up_chiamate(busta_id);',
      'CREATE INDEX IF NOT EXISTS idx_follow_up_data_generazione ON follow_up_chiamate(data_generazione);',
      'CREATE INDEX IF NOT EXISTS idx_follow_up_stato ON follow_up_chiamate(stato_chiamata);',
      'CREATE INDEX IF NOT EXISTS idx_follow_up_archiviato ON follow_up_chiamate(archiviato);',
      'CREATE INDEX IF NOT EXISTS idx_follow_up_priorita ON follow_up_chiamate(priorita);',
      'CREATE INDEX IF NOT EXISTS idx_statistiche_data ON statistiche_follow_up(data_riferimento);',
      'CREATE INDEX IF NOT EXISTS idx_statistiche_operatore ON statistiche_follow_up(operatore_id);'
    ];

    for (const index of indices) {
      const { error } = await supabase.rpc('sql', { query: index });
      if (error) {
        console.error('❌ Errore creazione indice:', error);
      }
    }

    console.log('✅ Indici creati\n');

    // Step 5: Funzione di calcolo priorità
    console.log('5️⃣ Creando funzione calcolo priorità...');

    const { error: funcError } = await supabase.rpc('sql', {
      query: `
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
      `
    });

    if (funcError) {
      console.error('❌ Errore creazione funzione:', funcError);
    } else {
      console.log('✅ Funzione calcolo priorità creata\n');
    }

    // Step 6: Test della struttura
    console.log('6️⃣ Test della struttura database...');

    const { data: tables, error: testError } = await supabase.rpc('sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('follow_up_chiamate', 'statistiche_follow_up');
      `
    });

    if (testError) {
      console.error('❌ Errore test struttura:', testError);
    } else {
      console.log('✅ Tabelle create:', tables?.map(t => t.table_name) || []);
    }

    console.log('\n🎉 Migrazione completata con successo!');

  } catch (error) {
    console.error('💥 Errore durante migrazione:', error);
  }
}

executeMigration();