# Gestionale Ottica Bianchi - Documentazione Completa

## Indice

1. [Introduzione](#introduzione)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Database e Modello Dati](#database-e-modello-dati)
4. [Sistema di Autenticazione e Ruoli](#sistema-di-autenticazione-e-ruoli)
5. [Il Ciclo di Vita della Busta](#il-ciclo-di-vita-della-busta)
6. [Interfacce Utente e Moduli](#interfacce-utente-e-moduli)
7. [Sistema di Note Vocali](#sistema-di-note-vocali)
8. [Gestione Ordini e Materiali](#gestione-ordini-e-materiali)
9. [Sistema di Pagamenti](#sistema-di-pagamenti)
10. [Sistema di Gestione Procedure](#sistema-di-gestione-procedure)
11. [Integrazione Telegram](#integrazione-telegram)
12. [Console Operativa](#console-operativa)
13. [Sicurezza e Controllo Accessi](#sicurezza-e-controllo-accessi)

---

## Introduzione

Il **Gestionale Ottica Bianchi** è un sistema di gestione completo progettato specificamente per un'ottica, che copre l'intero processo commerciale dalla prima visita del cliente fino alla consegna finale e al pagamento. Il sistema è costruito come una web application moderna utilizzando Next.js 14, TypeScript, Supabase per il database e l'autenticazione, e include un'innovativa integrazione Telegram per la gestione delle note vocali.

### Obiettivi del Sistema

- **Digitalizzazione completa del processo**: Eliminare i processi manuali e cartacei
- **Tracciabilità totale**: Ogni fase del processo è tracciata e documentata
- **Efficienza operativa**: Ridurre i tempi di gestione e aumentare la produttività
- **Gestione multi-ruolo**: Supporto per diversi livelli di accesso (Admin, Manager, Operatore)
- **Interfaccia intuitiva**: Dashboard Kanban per una visualizzazione immediata dello stato delle lavorazioni

### Processo di Lavoro Gestito

Il sistema segue il flusso naturale di un'ottica:

1. **Prima visita del cliente**: Creazione della scheda cliente e della prima "busta"
2. **Prescrizione e scelta prodotti**: Definizione dei materiali necessari
3. **Ordinazione materiali**: Gestione ordini verso fornitori diversificati
4. **Ricezione materiali**: Tracciamento arrivi parziali e completi
5. **Lavorazione**: Montaggio e preparazione prodotto finale
6. **Consegna e pagamento**: Ritiro da parte del cliente e saldo

Ogni progetto è rappresentato da una **"busta"** che attraversa diverse fasi su una board Kanban, rendendo immediata la comprensione dello stato di ogni lavorazione.

---

## Architettura del Sistema

### Stack Tecnologico

- **Frontend**: Next.js 14 con App Router, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Autenticazione**: Supabase Auth
- **State Management**: SWR per data fetching, Context API per stato utente
- **UI Components**: Lucide React per icone, Custom components
- **Drag & Drop**: @dnd-kit per la board Kanban
- **Build**: Vercel per deployment

### Struttura dell'Applicazione

```
src/
├── app/                        # App Router (Next.js 14)
│   ├── (app)/                 # Grouped routes con layout comune
│   ├── dashboard/             # Dashboard principale (Kanban)
│   ├── hub/                   # Hub moduli per admin/manager
│   ├── modules/               # Moduli specializzati
│   │   ├── voice-triage/      # Gestione note vocali
│   │   ├── operations/        # Console operativa
│   │   └── archive/           # Archivio buste
│   ├── admin/                 # Pannello amministrazione
│   ├── auth/                  # Callback autenticazione
│   └── api/                   # API routes
├── components/                # Componenti riusabili
├── context/                   # React Context providers
├── hooks/                     # Custom hooks
├── lib/                       # Utilities e configurazioni
├── telegram/                  # Bot Telegram
├── types/                     # TypeScript type definitions
└── middleware.ts              # Middleware autenticazione
```

### Filosofia di Design

- **Server-Side Rendering**: Le pagine principali sono renderizzate server-side per performance
- **Progressive Enhancement**: Funzionalità base senza JavaScript, enhancement con React
- **Mobile-First**: Design responsive ottimizzato per tablet e smartphone
- **Component-Based**: Architettura modulare con componenti riusabili
- **Type Safety**: TypeScript rigoroso per ridurre errori runtime

---

## Database e Modello Dati

### Entità Principali

#### 1. **buste** - Il Core del Sistema
La tabella `buste` rappresenta ogni progetto/lavorazione:

```sql
- id (UUID): Identificatore unico
- readable_id (string): Numero busta leggibile (es. "2024-001")
- cliente_id (UUID): Riferimento al cliente
- stato_attuale (enum): Stato corrente nel workflow
- data_apertura (date): Data creazione busta
- data_consegna_prevista (date): Stima consegna
- priorita (enum): normale|urgente|critica
- tipo_lavorazione (enum): OCV|OV|OS|LV|LS|LAC|ACC|RIC|RIP|SA|SG|CT|ES|REL|FT|SPRT
- note_generali (text): Note libere
- is_suspended (boolean): Busta sospesa
```

**Stati della Busta (Workflow Kanban)**:
- `nuove`: Appena create, in attesa di materiali
- `materiali_ordinati`: Ordini inviati ai fornitori
- `materiali_parzialmente_arrivati`: Alcuni materiali arrivati
- `materiali_arrivati`: Tutti i materiali disponibili
- `in_lavorazione`: Lavoro in corso nel laboratorio
- `pronto_ritiro`: Prodotto finito, cliente da contattare
- `consegnato_pagato`: Completato e archiviato

#### 2. **clienti** - Anagrafica Clienti
```sql
- id (UUID): Identificatore unico
- nome (string): Nome cliente
- cognome (string): Cognome cliente
- telefono (string): Numero telefono
- email (string): Email cliente
- data_nascita (date): Data nascita
- genere (string): M/F
- note_cliente (text): Note specifiche cliente
```

#### 3. **ordini_materiali** - Gestione Ordini
```sql
- id (UUID): Identificatore ordine
- busta_id (UUID): Riferimento alla busta
- descrizione_prodotto (text): Descrizione materiale
- stato (enum): da_ordinare|ordinato|in_arrivo|in_ritardo|consegnato|accettato_con_riserva|rifiutato
- da_ordinare (boolean): Flag per ordini da effettuare
- data_ordine (date): Data ordine effettuato
- data_consegna_prevista (date): Stima arrivo
- data_consegna_effettiva (date): Arrivo reale
- fornitore_*_id (UUID): Riferimenti ai vari tipi di fornitori
```

#### 4. **voice_notes** - Sistema Note Vocali
```sql
- id (UUID): Identificatore nota
- audio_blob (text): Audio codificato base64
- transcription (text): Trascrizione automatica
- addetto_nome (string): Nome operatore
- cliente_id (UUID): Cliente collegato
- busta_id (UUID): Busta collegata (opzionale)
- stato (string): pending|completed|archived
- processed_by (UUID): Chi ha gestito la nota
```

### Fornitori Specializzati

Il sistema gestisce cinque tipologie di fornitori:
- **fornitori_lenti**: Lenti oftalmiche
- **fornitori_montature**: Occhiali e montature
- **fornitori_lac**: Lenti a contatto
- **fornitori_sport**: Occhiali sportivi
- **fornitori_lab_esterno**: Laboratori esterni

Ogni fornitore ha:
- Nome, contatti (email, telefono, web)
- Tempi consegna medi
- Note specifiche

### Sistema di Pagamenti

- **info_pagamenti**: Informazioni pagamento per busta
- **rate_pagamenti**: Gestione rate e scadenze
- Sistema automatico di solleciti e promemoria

---

## Sistema di Autenticazione e Ruoli

### Tipologie Utente

Il sistema implementa tre ruoli principali con permessi differenziati:

#### 1. **Operatore** (Ruolo Base)
- **Accesso**: Dashboard principale, gestione buste assegnate
- **Permessi**: 
  - Visualizzare e modificare buste
  - Aggiornare stati nel Kanban
  - Gestire materiali e ordini
  - Accedere al dettaglio clienti
- **Restrizioni**: 
  - Non può eliminare buste o clienti
  - Non accede a report o statistiche avanzate
  - Non può gestire utenti

#### 2. **Manager** (Ruolo Intermedio)
- **Accesso**: Tutto dell'operatore + Console Operativa + Archivio
- **Permessi**:
  - Accesso alla Console Operativa per gestione ordini
  - Visualizzazione archivio buste completate
  - Azioni sicure su ordini (segnare ordinato, impostare ETA, segnare arrivato)
- **Restrizioni**:
  - Non può eliminare ordini
  - Non accede al Voice Triage
  - Non può gestire utenti

#### 3. **Admin** (Controllo Totale)
- **Accesso**: Tutte le funzionalità del sistema
- **Permessi**:
  - Gestione completa utenti e inviti
  - Accesso Voice Triage per note vocali
  - Eliminazione buste, ordini e dati
  - Accesso a tutti i report
  - Configurazione sistema

### Sistema di Inviti

Il sistema implementa un meccanismo di registrazione **solo su invito**:

1. **Admin invia invito**: Specifica email e ruolo desiderato
2. **Email di invito**: Utente riceve link di registrazione
3. **Registrazione guidata**: Creazione account con ruolo pre-assegnato
4. **Attivazione profilo**: Primo login completa la configurazione

### Middleware di Sicurezza

Il file `middleware.ts` implementa controlli rigorosi:

- **Protezione rotte admin**: `/admin/*`, `/modules/voice-triage`
- **Protezione rotte manager**: `/modules/archive`, `/modules/operations`
- **Redirect intelligenti**: Basati su ruolo utente
- **Refresh sessioni**: Mantenimento stato autenticazione
- **Controllo continuo**: Verifica permessi ad ogni richiesta

---

## Il Ciclo di Vita della Busta

### Flusso Completo

#### 1. **Creazione Busta** (`nuove`)
- Cliente entra in negozio per prima visita o controllo
- Operatore crea nuova busta collegata al cliente
- Definisce tipo lavorazione e priorità
- Sistema assegna numero busta progressivo

#### 2. **Definizione Materiali** (`nuove` → `materiali_ordinati`)
- Operatore aggiunge i materiali necessari
- Per ogni materiale specifica fornitore e caratteristiche
- Sistema calcola date consegna stimate
- Quando tutti i materiali sono definiti, busta passa a `materiali_ordinati`

#### 3. **Gestione Ordini** (`materiali_ordinati`)
- Operatore o Manager ordinano effettivamente i materiali
- Sistema traccia data ordine e fornitori
- Calcolo automatico ritardi basato su date previste
- Console Operativa mostra ordini da effettuare

#### 4. **Arrivi Materiali** (`materiali_parzialmente_arrivati` | `materiali_arrivati`)
- Arrivi parziali: Solo alcuni materiali disponibili
- Arrivo completo: Tutti i materiali ricevuti
- Sistema aggiorna automaticamente stato busta
- Notifiche automatiche per ritardi

#### 5. **Lavorazione** (`in_lavorazione`)
- Materiali completi, inizia montaggio/lavorazione
- Tracciamento responsabile lavorazione
- Gestione tentative multiple in caso di problemi
- Note specifiche per ogni tentativo

#### 6. **Pronto per Ritiro** (`pronto_ritiro`)
- Lavorazione completata, prodotto finito
- Sistema suggerisce contatto cliente
- Gestione appuntamenti e promemoria
- Possibilità di sospensione temporanea

#### 7. **Consegnato e Pagato** (`consegnato_pagato`)
- Cliente ha ritirato il prodotto
- Pagamento completato (saldo o ultima rata)
- Dopo 7 giorni busta diventa "archiviata"
- Rimane nel database ma non appare nel Kanban attivo

### Regole di Transizione

Il sistema implementa **regole di workflow rigorose**:

- Non si può saltare stati (es. da `nuove` a `materiali_arrivati`)
- Alcune transizioni richiedono condizioni specifiche
- Stati bloccanti per situazioni problematiche
- Log completo di tutti i cambi stato con timestamp e responsabile

### Workflow Speciali

Per certe tipologie di lavorazione il workflow può essere semplificato:
- **Riparazioni urgenti**: Possono saltare alcuni stati
- **Accessori**: Workflow accelerato senza lavorazione
- **Sostituzioni garanzia**: Gestione speciale senza pagamento

---

## Interfacce Utente e Moduli

### 1. **Dashboard Principale** (`/dashboard`)

#### Kanban Board
- **Visualizzazione**: 7 colonne rappresentanti gli stati delle buste
- **Drag & Drop**: Spostamento buste tra colonne per cambio stato
- **Validazione**: Sistema impedisce transizioni non valide
- **Real-time**: Aggiornamenti live con SWR
- **Responsive**: Ottimizzato per tablet e desktop

#### Statistiche in Tempo Reale
- Contatori per ogni colonna
- Buste in ritardo evidenziate
- Priorità visualizzate con colori
- Tempi medi di attraversamento

#### Filtri e Ricerca
- Filtro per cliente, periodo, stato
- Ricerca full-text
- Ordinamento personalizzabile
- Esportazione dati

### 2. **Hub Moduli** (`/hub`)

**Disponibile solo per Admin e Manager**, l'hub centralizza l'accesso ai moduli specializzati:

#### Console OB Moduli
- Accesso rapido alla dashboard principale
- Statistiche aggregate
- Buste in evidenza

#### Voice Triage (Solo Admin)
- Gestione note vocali da Telegram
- Collegamento note a clienti/buste
- Trascrizione automatica

#### Console Operativa (Manager/Admin)
- Gestione ordini per stato
- Azioni batch su ordini multipli
- Monitoring fornitori

#### Archivio (Manager/Admin)
- Consultazione buste completate
- Ricerca storica avanzata
- Statistiche performance

### 3. **Dettaglio Busta** (`/dashboard/buste/[id]`)

Interfaccia completa per gestione singola busta, organizzata in tab:

#### Tab Anagrafica
- Dati cliente completi
- Modifica informazioni
- Storico buste precedenti
- Note cliente

#### Tab Materiali
- Lista materiali richiesti
- Gestione ordini per fornitore
- Tracking stati singoli ordini
- Calcolo costi

#### Tab Lavorazione
- Dettagli tecnici montaggio
- Assegnazione responsabile
- Tracking tentativi
- Note tecniche

#### Tab Pagamento
- Impostazione prezzo finale
- Gestione acconti
- Rate e scadenze
- Storico pagamenti

#### Tab Notifiche
- Comunicazioni inviate
- Promemoria attivi
- Log contatti cliente

### 4. **Gestione Utenti** (`/admin/users`)

**Solo Admin**, interfaccia per:
- Lista tutti gli utenti registrati
- Modifica ruoli e informazioni
- Sistema inviti con ruoli pre-assegnati
- Controllo accessi e permessi

---

## Sistema di Note Vocali

### Filosofia del Sistema

Il **Voice Triage** risolve un problema operativo cruciale: quando un cliente passa in negozio mentre l'operatore è occupato, invece di aprire l'applicazione (tempo e complessità), l'operatore può rapidamente inviare una **nota vocale via Telegram** che sarà poi processata quando possibile.

### Flusso Operativo

1. **Cliente in negozio**: Situazione che richiede annotazione rapida
2. **Messaggio Telegram**: Operatore invia audio al bot
3. **Trascrizione automatica**: AssemblyAI converte audio in testo
4. **Storage sicuro**: Audio e testo salvati nel database
5. **Triage admin**: Admin ascolta, legge trascrizione, esegue azioni necessarie

---

## Sistema di Gestione Procedure

Il **Sistema di Gestione Procedure** trasforma la conoscenza operativa di Ottica Bianchi da documenti cartacei sparsi in un manuale digitale centralizzato, ricercabile e facilmente gestibile.

### Obiettivi del Sistema

- **Digitalizzazione delle procedure**: Trasformazione del materiale da `procedure_personale/` in formato digitale
- **Accesso centralizzato**: Punto unico per tutte le procedure operative
- **Ricerca avanzata**: Trovare rapidamente la procedura giusta per situazione/ruolo
- **Gestione ruoli**: Visualizzazione per tutti, modifica solo per admin
- **Tracciabilità**: Monitoraggio di visualizzazioni e aggiornamenti

### Struttura delle Procedure

#### Categorie (11)
Le procedure sono organizzate in 11 categorie operative:

- 🏠 **Accoglienza**: Procedure per l'accoglienza clienti e primi contatti
- 💰 **Vendita**: Processi di vendita e consulenza
- 📅 **Appuntamenti**: Gestione agenda e programmazione visite
- 🎛️ **Sala Controllo**: Controlli qualità e verifiche tecniche
- ⚙️ **Lavorazioni**: Processi di montaggio e lavorazione
- 📦 **Consegna**: Procedure di consegna e ritiro prodotti
- 📞 **Customer Care**: Follow-up e assistenza post-vendita
- 📊 **Amministrazione**: Processi amministrativi e gestionali
- 💻 **IT**: Procedure tecniche e informatiche
- 🏆 **Sport**: Procedure specifiche per ottica sportiva
- ⚡ **Straordinarie**: Procedure per situazioni eccezionali

#### Tipologie (4)
Ogni procedura è classificata per tipologia:

- **Checklist**: Liste di controllo step-by-step con checkbox
- **Istruzioni**: Guide operative dettagliate con spiegazioni
- **Formazione**: Materiali per training e onboarding
- **Errori Frequenti**: Troubleshooting e correzioni comuni

#### Ruoli Destinatari (6)
Le procedure sono targettizzate per ruoli specifici:

- **Addetti Vendita**: Personale front-office e vendita
- **Optometrista**: Personale tecnico specializzato
- **Titolare**: Proprietà e decisioni strategiche
- **Manager/Responsabile**: Gestione operativa e supervisione
- **Laboratorio**: Personale tecnico di lavorazione
- **Responsabile Sport**: Specialista ottica sportiva

### Funzionalità Principali

#### Per Tutti gli Utenti
- **Visualizzazione procedure** con rendering Markdown avanzato
- **Ricerca full-text** su titoli, descrizioni e tag
- **Filtri multi-dimensionali** per categoria, tipo e ruolo
- **Sistema favoriti** per bookmark delle procedure più utilizzate
- **Visualizzazione recenti** delle procedure consultate di recente
- **Procedure in evidenza** per contenuti prioritari

#### Per Amministratori
- **Gestione completa CRUD** (Create, Read, Update, Delete)
- **Editor Markdown** con anteprima e sintassi highlights
- **Gestione categorizzazione** e assegnazione ruoli
- **Export PDF** per stampa e distribuzione offline
- **Analytics di utilizzo** con contatori di visualizzazione
- **Gestione metadati** e revisioni

### Struttura Database

#### Tabella `procedures`
```sql
procedures (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,                    -- Titolo della procedura
  slug TEXT UNIQUE NOT NULL,              -- URL-friendly identifier
  description TEXT,                       -- Descrizione breve
  content TEXT NOT NULL,                  -- Contenuto Markdown completo
  context_category TEXT,                  -- Categoria (11 opzioni)
  procedure_type TEXT,                    -- Tipo (4 opzioni)
  target_roles TEXT[] DEFAULT '{}',       -- Array ruoli destinatari
  search_tags TEXT[] DEFAULT '{}',        -- Tag per ricerca
  is_featured BOOLEAN DEFAULT false,      -- Procedura in evidenza
  is_active BOOLEAN DEFAULT true,         -- Soft delete flag
  view_count INTEGER DEFAULT 0,           -- Contatore visualizzazioni
  mini_help_title TEXT,                   -- Titolo aiuto rapido
  mini_help_summary TEXT,                 -- Riassunto per card
  mini_help_action TEXT,                  -- Azione rapida suggerita
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  last_reviewed_at DATE,
  last_reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

#### Tabelle di Supporto
```sql
-- Sistema favoriti utente
procedure_favorites (
  user_id UUID REFERENCES profiles(id),
  procedure_id UUID REFERENCES procedures(id),
  UNIQUE(user_id, procedure_id)
)

-- Log accessi per analytics
procedure_access_log (
  procedure_id UUID REFERENCES procedures(id),
  user_id UUID REFERENCES profiles(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Relazioni tra procedure (future)
procedure_dependencies (
  procedure_id UUID REFERENCES procedures(id),
  depends_on_id UUID REFERENCES procedures(id),
  relationship_type TEXT -- 'prerequisite', 'related', 'follows'
)
```

### Interfacce Utente

#### Pagina Principale (`/procedure`)
- **Layout a card** con preview visuale delle categorie
- **Tabs di navigazione**: In Evidenza, Tutte, Recenti, Preferite
- **Barra di ricerca** con filtri avanzati
- **Mini-help cards** con riassunti rapidi
- **Design responsive** per mobile e desktop

#### Visualizzazione Procedura (`/procedure/[slug]`)
- **Rendering Markdown** con styling professionale
- **Supporto per checklist** con simboli ✅ ❌
- **Breadcrumb navigation** e metadati
- **Pulsante favoriti** e tracking visualizzazioni
- **Navigazione procedure correlate**

#### Dashboard Admin (`/procedure/admin`)
- **Tabella gestionale** con tutte le procedure
- **Statistiche utilizzo** (visualizzazioni, ultima modifica)
- **Azioni rapide**: Visualizza, Modifica, Esporta PDF, Elimina
- **Filtri e ricerca** per gestione di grandi volumi

#### Editor Admin (`/procedure/admin/[slug]`)
- **Form completo** per tutti i campi della procedura
- **Editor Markdown** con syntax highlighting
- **Selezione categorie e ruoli** con checkbox
- **Anteprima real-time** del contenuto
- **Validazione e salvataggio** con feedback utente

### API Endpoints

#### Endpoint Pubblici (Utenti Autenticati)
```
GET /api/procedures
- Lista procedure con ricerca e filtri
- Parametri: search, context_category, procedure_type, target_role, featured, favorites, recent

GET /api/procedures/[slug]
- Dettaglio singola procedura
- Include status favoriti e incrementa view_count

POST /api/procedures/[slug]/favorite
- Toggle status favoriti per l'utente corrente
```

#### Endpoint Admin
```
POST /api/procedures
- Creazione nuova procedura (solo admin)

PUT /api/procedures/[slug]
- Aggiornamento procedura esistente (solo admin)
- Auto-genera nuovo slug se cambia il titolo

DELETE /api/procedures/[slug]
- Soft delete procedura (is_active = false) (solo admin)

GET /api/procedures/[slug]/pdf
- Export HTML/PDF per stampa (solo admin)
```

### Migrazione e Seeding

#### Processo di Migrazione
1. **Schema Creation**: Esecuzione `scripts/procedures_migration.sql`
2. **Data Import**: Esecuzione `scripts/seed_procedures.sql`
3. **Integrazione UI**: Aggiunta link nella sidebar principale

#### Procedure Migrate
Dal folder `procedure_personale/` sono state migrate 5 procedure:

1. **Procedura Introduttiva – Benvenuto in Ottica Bianchi** (Accoglienza/Formazione)
2. **Procedura Creazione Busta Lavoro** (Lavorazioni/Checklist)
3. **Gestione Pause** (Amministrazione/Istruzioni)
4. **Consegna Occhiali con Lenti Progressive** (Consegna/Istruzioni)
5. **Procedura Ricontatto Clienti Lenti Varifocali** (Customer Care/Checklist)

### Sicurezza e Controlli

#### Controllo Accessi
- **Visualizzazione**: Tutti gli utenti autenticati
- **Modifica/Creazione/Eliminazione**: Solo utenti con ruolo `admin`
- **RLS Policies**: Protezione a livello database
- **Service Role**: Operazioni admin utilizzano service role key

#### Audit Trail
- **Tracking modifiche**: Campi `updated_by` e `updated_at`
- **Log accessi**: Tabella `procedure_access_log`
- **Soft delete**: Mantenimento storico con `is_active = false`
- **Versioning**: Campo `last_reviewed_at` per tracking revisioni

### Integrazioni

#### Con Sistema Esistente
- **Sidebar Navigation**: Link principale nel menu "Gestione"
- **Role System**: Integrazione con sistema ruoli esistente
- **Supabase Auth**: Utilizzo autenticazione centralizzata
- **Design System**: Coerenza con UI/UX dell'applicazione

#### Future Integrazioni
- **Notifiche**: Alert per aggiornamenti procedure
- **Workflow**: Collegamento con stati buste per procedure contestuali
- **Training**: Sistema di certificazione completamento procedure
- **Mobile App**: Accesso offline alle procedure più critiche

---

### Integrazione Telegram

#### Bot Configuration
- **Token sicuro**: Webhook verificato con secret token
- **Comandi base**: `/start`, `/help`, `/status`
- **Multi-formato**: Voice messages, file audio, documenti audio
- **Riconoscimento utenti**: Mapping username Telegram → operatore

#### Gestione Audio
- **Formati supportati**: OGG, MP3, WAV, M4A, AAC
- **Download sicuro**: Via API Telegram
- **Encoding**: Base64 per storage database
- **Limiti**: Max 20MB per file, 10 minuti durata

### Trascrizione

#### Modalità attuale (auto)
- La trascrizione avviene direttamente nel webhook Telegram: appena arriva l'audio lo inviamo ad AssemblyAI, salviamo il testo nella relativa `voice_notes.transcription` e mostriamo subito il contenuto nella dashboard.
- Collegare la nota a una busta può comunque forzare una ritrascrizione (`redo_transcription`) per avere un testo aggiornato o più accurato; in quel caso aggiorniamo sia la nota sia il blocco in `buste.note_generali` contrassegnato con `[VoiceNote <id>]`.
- Collegare solo il Cliente mantiene la nota trascritta ma non aggiorna la busta.
- Gli amministratori e i manager possono riprodurre/scaricare l'audio e gestire lo stato della nota; gli operatori hanno sola lettura.

#### AssemblyAI Integration
- **API Key**: Configurata in variabili ambiente
- **Linguaggio**: Ottimizzato per italiano
- **Accuratezza**: Circa 85-95% su audio chiaro
- **Fallback**: Sistema continua a funzionare anche senza trascrizione

#### Processo Trascrizione (al collegamento alla busta)
1. Upload audio ad AssemblyAI (on‑demand)
2. Polling fino a completamento
3. Salvataggio testo nella `voice_notes.transcription`
4. Append idempotente in `buste.note_generali` con marcatore `[VoiceNote <id>]`
5. La nota resta "pending" finché un operatore non la marca "completed"

### Voice Triage Interface

**Accessibile solo agli Admin** tramite `/modules/voice-triage`:

#### Lista Note Vocali
- **Audio player**: Riproduzione diretta nel browser
- **Trascrizione**: Testo affianco all'audio
- **Metadati**: Chi, quando, durata, dimensione file
- **Stato**: Pending, processed, archived

#### Azioni Disponibili
- **Play/Pause**: Controlli audio integrati
- **Download**: Scarica file audio originale
- **Collegamento**: Associa nota a cliente esistente
- **Creazione busta**: Genera nuova busta da nota vocale
- **Completamento**: Segna nota come processata
- **Eliminazione**: Rimuove nota (solo admin)

#### Ricerca Clienti Integrata
Durante il voice triage è possibile:
- Cercare clienti per nome/cognome/telefono
- Visualizzare buste esistenti del cliente
- Creare nuova busta direttamente dalla ricerca
- Collegare nota vocale a busta specifica

---

## Gestione Ordini e Materiali

### Tipologie di Materiali

Il sistema gestisce cinque categorie principali:

#### 1. **Lenti** (`tipi_lenti`)
- Progressive, monofocali, bifocali
- Trattamenti speciali (antiriflesso, indurimento, etc.)
- Materiali (CR-39, policarbonato, high-index)
- Tempi consegna stimati per tipo

#### 2. **Montature** 
- Metallo, acetato, titanio
- Marchi e modelli
- Taglie e varianti colore
- Disponibilità e listini

#### 3. **Lenti a Contatto** (LAC)
- Giornaliere, mensili, semestrali
- Toriche, multifocali, colorate
- Marchi e parametri
- Gestione scadenze

#### 4. **Articoli Sportivi**
- Occhiali sport-specifici
- Lenti intercambiabili
- Accessori (cordini, custodie)

#### 5. **Laboratorio Esterno**
- Lavorazioni speciali non fattibili internamente
- Riparazioni complesse
- Trattamenti particolari

### Stati degli Ordini

Ogni ordine materiale attraversa questi stati:

- **`da_ordinare`**: Materiale definito ma non ancora ordinato
- **`ordinato`**: Ordine inviato al fornitore
- **`in_arrivo`**: Confermato dal fornitore, in transit
- **`in_ritardo`**: Oltre la data prevista, alert automatico
- **`consegnato`**: Arrivato e verificato
- **`accettato_con_riserva`**: Arrivato ma con problemi minori
- **`rifiutato`**: Non conforme, da ri-ordinare

### Console Operativa

Interfaccia specializzata per Manager e Admin (`/modules/operations`):

#### Tab "Da Ordinare"
- **Filtro automatico**: Solo ordini con stato `da_ordinare`
- **Azioni batch**: Seleziona multipli e ordina insieme
- **Raggruppamento**: Per fornitore per ordini combinati
- **Priorità**: Evidenzia ordini urgenti

#### Tab "Ordinati"
- **Tracking**: Ordini inviati in attesa conferma
- **Aggiornamento ETA**: Modifica date previste
- **Note ordini**: Comunicazioni con fornitori

#### Tab "In Arrivo"
- **Calendario consegne**: Vista per data arrivo
- **Preparazione ricezione**: Lista materiali attesi
- **Conferma arrivi**: Azione rapida conferma

#### Tab "In Ritardo"
- **Alert automatici**: Ordini oltre data prevista
- **Calcolo giorni ritardo**: Automatico
- **Azioni correttive**: Sollecito fornitore, cambio ETA
- **Comunicazione cliente**: Notifica ritardi

#### Azioni Disponibili per Manager
- ✅ **Segna ordinato**: Cambia stato + imposta data ordine + flag da_ordinare false
- ✅ **Imposta ETA**: Modifica data consegna prevista
- ✅ **Segna arrivato**: Conferma consegna + data effettiva
- ✅ **Modifica note**: Aggiunge informazioni ordine
- ❌ **Elimina ordine**: Solo admin (protezione dati)

### Integrazione con Workflow Buste

Il sistema di ordini è **sincronizzato automaticamente** con gli stati delle buste:

- **Busta → `materiali_ordinati`**: Quando almeno un ordine passa a `ordinato`
- **Busta → `materiali_parzialmente_arrivati`**: Quando alcuni (non tutti) ordini sono `consegnato`
- **Busta → `materiali_arrivati`**: Quando TUTTI gli ordini sono `consegnato`

### Gestione Fornitori

#### Database Fornitori
- **Specializzazione**: Ogni fornitore appartiene a una categoria specifica
- **Tempi consegna medi**: Usati per calcolo automatico ETA
- **Contatti**: Email, telefono, sito web per comunicazioni
- **Note**: Condizioni speciali, orari, modalità ordini

#### SLA e Performance
- **Tracking ritardi**: Calcolo automatico giorni ritardo per fornitore
- **Performance metrics**: Percentuale consegne puntuali
- **Alert automatici**: Notifiche per fornitori problematici

---

## Sistema di Pagamenti

### Modalità di Pagamento

#### Pagamento Immediato
- **Contanti**: Registrazione immediata
- **Carta**: POS o online
- **Bonifico**: Con tracking degli incassi
- **Assegno**: Con data valuta

#### Pagamento Dilazionato
- **Acconto + Saldo**: Schema classico (30-50% + resto alla consegna)
- **Rate mensili**: Fino a 12 rate personalizzabili
- **Soluzioni personalizzate**: Per clienti abituali

### Gestione Acconti

```sql
info_pagamenti:
- prezzo_finale: Importo totale pattuito
- ha_acconto: true/false
- importo_acconto: Cifra versata in anticipo
- data_acconto: Quando versato
- modalita_saldo: Come pagherà il resto
```

### Sistema Rate

```sql
rate_pagamenti:
- numero_rata: Progressivo (1, 2, 3...)
- importo_rata: Singolo importo
- data_scadenza: Quando deve essere pagata
- is_pagata: Stato pagamento
- data_pagamento: Quando effettivamente pagata
```

### Reminder Automatici

Il sistema implementa **promemoria automatici**:

#### Logica Reminder
- **7 giorni prima**: Promemoria cortese via email/SMS
- **Giorno scadenza**: Notifica scadenza
- **3 giorni dopo**: Sollecito gentile
- **7 giorni dopo**: Sollecito formale

#### Configurazione Reminder
- **Attivazione per rata**: `reminder_attivo = true/false`
- **Ultimo inviato**: `ultimo_reminder` per evitare duplicati
- **Personalizzazione**: Template messaggi per tipo cliente

### Integrazione con Stati Busta

- **Acconto versato**: Abilita inizio lavorazione se materiali pronti
- **Saldo completo**: Busta può passare a `consegnato_pagato`
- **Rate scadute**: Blocco nuove buste per cliente moroso (opzionale)

### Reporting Finanziario

#### Dashboard Admin
- **Incassi del mese**: Totale e dettaglio per modalità
- **Rate in scadenza**: Calendario prossimi incassi
- **Crediti aperti**: Clienti con pagamenti pendenti
- **Performance**: Tempo medio pagamento, % puntualità

---

## Console Operativa

### Filosofia

La **Console Operativa** (`/modules/operations`) è progettata per dare ai **Manager** un controllo operativo completo sui materiali e ordini, **senza permettere azioni distruttive**. È l'interfaccia primaria per chi si occupa della logistica e coordinamento fornitori.

### Interfaccia Tabbed

#### Tab "Da Ordinare"
**Obiettivo**: Visualizzare tutti i materiali che devono ancora essere ordinati

- **Dati mostrati**: 
  - Busta di riferimento (numero leggibile)
  - Cliente (cognome nome)
  - Descrizione prodotto dettagliata
  - Data consegna prevista
- **Azioni disponibili**:
  - `Segna ordinato`: Cambia stato ordine + imposta data_ordine + da_ordinare=false
  - `Imposta ETA`: Modifica data consegna prevista
  - `Note`: Aggiungi/modifica note ordine

#### Tab "Ordinati" 
**Obiettivo**: Monitoraggio ordini inviati ma non ancora arrivati

- **Filtro automatico**: `stato = 'ordinato'`
- **Informazioni chiave**: Data ordine effettuato, fornitore, ETA
- **Azioni**:
  - Aggiorna ETA se fornitore comunica cambi
  - Note per tracking comunicazioni

#### Tab "In Arrivo"
**Obiettivo**: Ordini confermati in transit dal fornitore

- **Vista calendario**: Raggruppamento per data arrivo prevista
- **Preparazione ricezione**: Lista cosa aspettare oggi/domani
- **Azione principale**: `Segna arrivato` quando materiale arriva fisicamente

#### Tab "In Ritardo"
**Obiettivo**: Alert e gestione ritardi automatici

- **Calcolo automatico**: Ordini oltre `data_consegna_prevista`
- **Evidenziazione**: Giorni di ritardo calcolati
- **Azioni correttive**:
  - Sollecito fornitore (note/email)
  - Aggiornamento ETA realistica
  - Comunicazione cliente se ritardo significativo

#### Tab "Tutti"
**Obiettivo**: Vista completa per ricerche e analisi

- **Tutti gli ordini**: Senza filtri di stato
- **Ricerca avanzata**: Per cliente, fornitore, prodotto, periodo
- **Export dati**: Per analisi esterne

### Azioni Manager (Sicure)

#### ✅ Azioni Permesse
1. **Segna ordinato**: 
   - `stato = 'ordinato'`
   - `da_ordinare = false`
   - `data_ordine = oggi`

2. **Imposta ETA**: 
   - Modifica `data_consegna_prevista`
   - Ricalcolo automatico ritardi

3. **Segna arrivato**:
   - `stato = 'consegnato'`
   - `data_consegna_effettiva = oggi`
   - Trigger aggiornamento stato busta

4. **Modifica note**:
   - Campo `note` per tracking comunicazioni

#### ❌ Azioni Vietate (Solo Admin)
- Eliminare ordini (protezione dati)
- Modificare prezzi o fornitori
- Cancellare buste
- Accesso gestione utenti

### API Backend Sicure

#### GET `/api/ordini?status=...`
- **Autenticazione**: Richiede login
- **Autorizzazione**: Solo manager/admin
- **Server-side filtering**: Filtri applicati lato database
- **Service role**: Query con privilegi elevati dopo controllo ruolo

#### PATCH `/api/ordini/[id]`
- **Campi permessi**: Solo `stato`, `da_ordinare`, `data_consegna_prevista`, `data_consegna_effettiva`, `data_ordine`, `note`
- **Validazione**: Server verifica manager/admin
- **Atomic updates**: Transazioni database per consistency
- **Trigger sync**: Aggiornamento automatico stati buste correlate

### Integrazione Real-time

- **SWR caching**: Dati aggiornati automaticamente
- **Refresh button**: Aggiornamento manuale su richiesta
- **Loading states**: Feedback visivo durante operazioni
- **Error handling**: Gestione errori di rete/server

---

## Sicurezza e Controllo Accessi

### Row Level Security (RLS)

Supabase implementa **Row Level Security** a livello database:

#### Policies per Ruolo

**Operatori**:
```sql
-- Possono vedere solo buste non archiviate
CREATE POLICY operatore_buste ON buste 
FOR SELECT USING (stato_attuale != 'consegnato_pagato' OR updated_at > now() - interval '7 days');

-- Possono modificare buste assegnate
CREATE POLICY operatore_update ON buste 
FOR UPDATE USING (creato_da = auth.uid());
```

**Manager**:
```sql
-- Accesso completo buste e ordini (lettura)
CREATE POLICY manager_read ON buste FOR SELECT USING (true);

-- Update sicuro ordini materiali
CREATE POLICY manager_ordini ON ordini_materiali 
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin'))
);
```

**Admin**:
```sql
-- Accesso completo a tutto
CREATE POLICY admin_all ON * FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

### Middleware di Protezione

Il `middleware.ts` implementa **controlli preventivi**:

#### Protezione Route-Based
```typescript
// Admin-only paths
const adminPaths = ['/admin', '/modules/voice-triage']
const managerPaths = ['/modules/archive', '/modules/operations'] 
const protectedPaths = ['/dashboard', '/profile', '/modules']
```

#### Validazione Continua
- **Ad ogni richiesta**: Verifica sessione valida
- **Controllo ruolo**: Query profilo utente per autorizzazione
- **Redirect intelligenti**: Basati su ruolo e destinazione
- **Session refresh**: Mantenimento automatico stato auth

### API Security

#### Authentication Required
```typescript
// Ogni API route verifica autenticazione
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

#### Role-Based Authorization
```typescript
// Admin-only endpoints
if (profile?.role !== 'admin') {
  return NextResponse.json({ error: 'Admin required' }, { status: 403 })
}

// Manager-or-above endpoints  
if (!['admin', 'manager'].includes(profile?.role)) {
  return NextResponse.json({ error: 'Manager required' }, { status: 403 })
}
```

### Telegram Security

#### Webhook Verification
```typescript
// Verifica secret token Telegram
const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const providedSecret = request.headers.get('x-telegram-bot-api-secret-token');
if (configuredSecret && providedSecret !== configuredSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

#### User Mapping Sicuro
- **Username Telegram → Operatore**: Mapping controllato admin
- **Voice notes isolate**: Ogni operatore accede solo alle proprie
- **Admin oversight**: Solo admin può accedere a tutte le note

### Data Protection

#### Audio Storage
- **Base64 encoding**: Audio convertito per storage database sicuro
- **Access control**: Solo admin possono riprodurre/scaricare audio
- **Retention policy**: Per note marcate "completed" l'audio viene rimosso automaticamente dopo 7 giorni; restano metadati e trascrizione

#### Personal Data
- **GDPR compliance**: Diritto cancellazione dati cliente
- **Data minimization**: Solo dati necessari per servizio
- **Audit trail**: Log completo accessi e modifiche

#### Environment Variables
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # Server-only, privilegi elevati

# Telegram  
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=

# Transcription
ASSEMBLYAI_API_KEY=
```

### Logging e Monitoring

#### Application Logs
- **Request tracking**: Ogni middleware log richiesta e user
- **Error logging**: Stack trace completi in development
- **Performance monitoring**: Tempi risposta API

#### Security Events
- **Failed auth attempts**: Log tentativi accesso non autorizzati
- **Role violations**: Attempt accesso risorse non permesse
- **Data modifications**: Chi cambia cosa quando

#### Alerting
- **Failed webhooks**: Problemi integrazione Telegram
- **Database errors**: Connessione o query fallite
- **Unusual activity**: Pattern di accesso anomali

---

## Conclusioni

Il **Gestionale Ottica Bianchi** rappresenta una soluzione completa e moderna per la digitalizzazione di un'ottica, coprendo ogni aspetto del processo commerciale dalla prima visita del cliente fino alla consegna finale e pagamento.

### Punti di Forza

1. **Workflow Naturale**: Il sistema segue il flusso operativo reale di un'ottica
2. **Interfaccia Intuitiva**: Dashboard Kanban per comprensione immediata degli stati
3. **Multi-Ruolo**: Tre livelli di accesso con permessi granulari
4. **Innovazione Voice**: Integrazione Telegram per note vocali risolve problema operativo reale  
5. **Sicurezza Robusta**: RLS, middleware, API protette, controlli continui
6. **Scalabilità**: Architettura moderna pronta per crescita
7. **Mobile-Ready**: Responsive design ottimizzato per tablet e smartphone

### Benefici Operativi

- **Eliminazione Carta**: Processo completamente digitale
- **Tracciabilità Completa**: Ogni azione documentata con timestamp e responsabile
- **Riduzione Errori**: Validazioni automatiche e workflow guidati
- **Miglior Servizio Cliente**: Storico completo e comunicazioni tracciate
- **Controllo Gestionale**: Report e statistiche per decisioni data-driven
- **Efficienza Team**: Ruoli chiari, responsabilità definite, collaborazione fluida

### Tecnologie All'Avanguardia

- **Next.js 14**: Framework React moderno con App Router
- **Supabase**: Database PostgreSQL con autenticazione integrata  
- **Real-time Updates**: SWR per sincronizzazione automatica dati
- **TypeScript**: Type safety per riduzione errori runtime
- **Responsive Design**: Tailwind CSS per interfaccia moderna

Il sistema rappresenta un esempio eccellente di come la tecnologia moderna possa essere applicata per risolvere problemi operativi concreti in un settore tradizionale come l'ottica, migliorando significativamente l'efficienza operativa e la qualità del servizio al cliente.

---

## Aggiornamenti Recenti (UI, Fornitori, Note Vocali, Follow-up, Error Tracking)

Questa sezione riassume le principali modifiche implementate in questa iterazione.

### **Filtri Ordini e Gestione Fornitori**
- Il pulsante "Chiama" è stato sostituito da "Apri portale": se il fornitore ha `web_address`, si apre il sito B2B in una nuova scheda per inserire l'ordine; rimane disponibile il pulsante Email.
- La vista ora mostra "Portale" come metodo preferito quando presente l'URL.
- Aggiunto pulsante "Gestisci fornitori" nella testata per accesso rapido.
- Nuovo modulo: `/modules/fornitori` con tab per categoria (lenti, montature, lac, sport, lab. esterno).
- Campi gestiti: `nome`, `referente_nome`, `telefono`, `email`, `web_address` (URL ordini), `tempi_consegna_medi`, `note`.
- API protette per creare/aggiornare fornitori; aggiunta colonna `referente_nome` a tutte le tabelle fornitori.
- Script utili: `scripts/add_supplier_referente.sql` e `scripts/seed_supplier_portals.sql` (placeholders da sostituire con URL reali).

### **Note Vocali (Voice Triage)**
- UI più compatta: card ridotte, griglia più densa, testo e icone più piccoli per consultazione rapida.
- Collegamento rapido: dalla ricerca cliente è possibile collegare la nota a un Cliente ("Collega al Cliente") o a una specifica Busta ("Collega qui").
- Ritrascrizione su collegamento: se l'audio è ancora presente e si richiede la ritrascrizione, il sistema invia l'audio ad AssemblyAI e, al termine, aggiunge automaticamente il testo a `note_generali` della busta (con marcatore `[VoiceNote <id>]`, idempotente).
- Retention: dopo 7 giorni dal completamento (`processed_at`), l'audio viene rimosso dal database (svuotiamo `audio_blob` e azzeriamo `file_size`); restano metadati e trascrizione. È prevista un'API di manutenzione schedulata (cron) per sostituire la pulizia lato GET admin.

### **Sistema Follow-up** ✅ **COMPLETATO (14 Settembre 2025)**
- **Scopo**: Tracciamento automatico chiamate di soddisfazione post-vendita con prioritizzazione intelligente basata su valore e tipo acquisto.
- **Interfaccia**: `/dashboard/follow-up` con gestione liste chiamate e dashboard statistiche real-time.
- **Logica Prioritizzazione**:
  - **Alta**: €400+ OCV/OV (occhiali completi con lenti) - chiamate immediate
  - **Normale**: Primo acquisto LAC O €100+ LV (solo lenti) - chiamate standard
  - **Bassa**: €400+ OS (occhiali da sole) - fine lista chiamate
- **Stati Chiamata**: da_chiamare, chiamato_completato, non_vuole_essere_contattato, non_risponde, cellulare_staccato, numero_sbagliato, richiamami
- **Livelli Soddisfazione**: molto_soddisfatto, soddisfatto, poco_soddisfatto, insoddisfatto
- **Generazione Automatica**: Liste create per consegne 14-7 giorni fa con esclusione già processate
- **Analytics Avanzate**: Viste temporali multiple, performance operatori, insights real-time
- **Integrazione**: Checkbox primo acquisto LAC in MaterialiTab, collegamento dati buste/clienti
- **Funzionalità Debug**: Infrastruttura completa per troubleshooting generazione liste

### **Sistema Error Tracking** ✅ **COMPLETATO**
- **Scopo**: Monitoraggio completo performance team con tracciamento costi errori e generazione automatica lettere richiamo.
- **Interfaccia**: `/errori` con accesso basato su ruoli (operatore: sola lettura, manager/admin: scrittura)
- **Categorie Errori**:
  - **Critico**: €200-500 (rifacimenti importanti, clienti persi)
  - **Medio**: €50-200 (ricontatti, ritardi)
  - **Basso**: €5-50 (correzioni minori)
- **Tipi Errore**: anagrafica_cliente, materiali_ordine, comunicazione_cliente, misurazioni_vista, controllo_qualita, consegna_prodotto, gestione_pagamenti, voice_note_processing, busta_creation, altro
- **Sistema Lettere Richiamo**:
  - Richiami verbali (solo registrazione)
  - Richiami scritti (generazione PDF)
  - Provvedimenti disciplinari (lettere formali)
  - Sistema email con allegati PDF
- **Reportistica Automatica**: Report HTML settimanali, mensili, trimestrali, semestrali, annuali
- **Tracciamento Costi**: Costi reali vs stimati, calcolo automatico, tracking tempo perso
- **Analytics Performance**: Ranking dipendenti, analisi costi, monitoraggio trend
- **Integrazione**: Collegamenti a buste e clienti per contesto completo

### **Pagamenti (ASAP – revisione modellazione)**
- Confermata l'adozione del modello semplificato `buste_finance` + `payments` per rendere immediata la registrazione incassi, saldo e chiusura busta. Dettagli in Application Architecture Guide.

### **Messaggi Implementazione**

**Follow-up System**:
- Sistema "Swiss clock" per affidabilità: retry/backoff, idempotenza, logging dettagliato
- Debug infrastructure completa per troubleshooting
- Enhanced statistics con trend analysis e performance insights
- LAC first purchase tracking completamente integrato

**Error Tracking System**:
- Audit trail completo per gestione performance team
- Warning letter system con templates professionali
- Cost tracking comprehensivo con real-time analytics
- Integration completa con workflow esistente

**Note Tecniche**:
- Follow-up system include infrastruttura debug completa per troubleshooting generazione liste
- Error tracking system fornisce audit trail completo per gestione performance team
- Migliorare l'affidabilità della pipeline Telegram → Nota vocale → Trascrizione: deve funzionare "come un orologio svizzero"
- Introdurre endpoint manutenzione per archiviazione/eliminazione note dopo 7 giorni
- Valutare migrazione audio da `audio_blob` a Supabase Storage con URL firmati
