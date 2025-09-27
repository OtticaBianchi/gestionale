# Sistema Follow-up Chiamate Post-Vendita

**Data implementazione:** 14 Settembre 2025
**Stato:** ✅ Completato e funzionante
**Autore:** Claude Code Assistant

## 📋 Panoramica

Il sistema di follow-up chiamate è stato progettato per automatizzare e tracciare le chiamate di soddisfazione post-vendita ai clienti, implementando una logica di prioritizzazione basata sul tipo di acquisto e valore della transazione.

## 🎯 Obiettivi Raggiunti

### 1. **Automazione Intelligente**
- Generazione automatica liste chiamate basata su criteri temporali (18-11 giorni dalla consegna)
- Prioritizzazione automatica basata su tipo acquisto e valore economico
- Esclusione automatica di clienti già contattati con successo

### 2. **Gestione Operativa Completa**
- Interface operatore per gestione stati chiamate
- Tracking dettagliato livelli di soddisfazione (4 livelli)
- Gestione casi problematici (numero sbagliato, non risponde, etc.)
- Sistema di richiamata programmata con orari personalizzati

### 3. **Analytics e Performance**
- Dashboard statistiche real-time per operatore
- Insights automatici su performance e soddisfazione clienti
- Tracking problemi tecnici (numeri errati, staccati)
- Calcolo automatico tassi completamento e soddisfazione

## 🏗️ Architettura Implementata

### **Database Schema**

#### Tabella `follow_up_chiamate`
```sql
CREATE TABLE follow_up_chiamate (
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
```

#### Tabella `statistiche_follow_up`
```sql
CREATE TABLE statistiche_follow_up (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_riferimento DATE NOT NULL DEFAULT CURRENT_DATE,
  operatore_id UUID REFERENCES profiles(id),

  -- Contatori performance
  chiamate_totali INTEGER DEFAULT 0,
  chiamate_completate INTEGER DEFAULT 0,
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
  UNIQUE(data_riferimento, operatore_id)
);
```

#### Modifica Tabella `materiali`
```sql
ALTER TABLE materiali ADD COLUMN primo_acquisto_lac BOOLEAN DEFAULT FALSE;
```

### **API Endpoints**

#### `POST /api/follow-up/generate`
- **Scopo**: Genera nuova lista chiamate follow-up
- **Logica**: Query buste consegnate 18-11 giorni fa, calcola priorità, esclude già chiamate
- **Output**: Lista clienti da contattare ordinata per priorità e anzianità

#### `GET /api/follow-up/calls`
- **Scopo**: Recupera lista chiamate correnti
- **Filtri**: `archived=true/false` per includere/escludere archiviate
- **Output**: Chiamate con dati cliente, busta, e storico

#### `PATCH /api/follow-up/calls/[id]`
- **Scopo**: Aggiorna stato chiamata
- **Automatismi**: Auto-set data chiamata e completamento
- **Trigger**: Aggiorna statistiche real-time

#### `GET /api/follow-up/statistics`
- **Scopo**: Dashboard statistiche performance
- **Filtri**: Per data e operatore
- **Output**: Statistiche aggregate + summary totali

### **Logica di Prioritizzazione**

```typescript
function calcolaPriorita(prezzo: number, tipoLavorazione: string, primoAcquistoLAC: boolean) {
  // 🔴 PRIORITÀ ALTA - Telefonate immediate
  if (prezzo >= 400 && ['OCV', 'OV'].includes(tipoLavorazione)) {
    return 'alta'; // Lenti + Occhiali sopra 400€
  }

  // 🟡 PRIORITÀ NORMALE - Telefonate standard
  if (primoAcquistoLAC || (prezzo >= 100 && tipoLavorazione === 'LV')) {
    return 'normale'; // Prime LAC o Lenti da vista sopra 100€
  }

  // 🟢 PRIORITÀ BASSA - Telefonate a fine lista
  if (prezzo >= 400 && tipoLavorazione === 'OS') {
    return 'bassa'; // Occhiali da sole sopra 400€
  }

  // 📱 WHATSAPP ONLY (implementazione futura)
  if (tipoLavorazione === 'OS' && prezzo >= 100 && prezzo < 400) {
    return 'whatsapp_only';
  }

  return null; // Nessun follow-up
}
```

## 🖥️ Interfaccia Utente

### **Struttura Componenti**

```
/dashboard/follow-up/
├── page.tsx                 # Pagina principale
├── _components/
│   ├── FollowUpClient.tsx   # Client principale con state management
│   ├── CallList.tsx         # Lista chiamate prioritizzate
│   ├── CallItem.tsx         # Singola chiamata con form azioni
│   ├── StatisticsDashboard.tsx # Dashboard analytics
│   ├── StatisticsTable.tsx  # Tabella dettagliata performance
│   ├── StatCard.tsx         # Card statistiche visuali
│   ├── TabNavigation.tsx    # Switch Chiamate/Statistiche
│   └── GenerateListButton.tsx # Pulsante generazione lista
├── _hooks/
│   └── useFollowUpData.ts   # Hook per data management
└── _types/
    └── index.ts             # Tipi TypeScript
```

### **Flusso Operativo**

1. **Operatore accede** a `/dashboard/follow-up`
2. **Clicca "Genera Lista"** → Sistema crea lista prioritizzata
3. **Visualizza chiamate** raggruppate per priorità (Alta/Normale/Bassa)
4. **Per ogni chiamata:**
   - Seleziona stato esito (completata, non risponde, etc.)
   - Se completata → Indica livello soddisfazione
   - Se "richiamami" → Imposta orario preferito
   - Aggiunge note libere
5. **Salva** → Sistema aggiorna database e statistiche
6. **Dashboard statistiche** mostra performance real-time

### **Funzionalità UX**

- **Prioritizzazione visiva**: Colori diversi per ogni priorità
- **Contatori real-time**: Numero chiamate per priorità
- **Form contestuali**: Campi dinamici basati su stato selezionato
- **Insights automatici**: Consigli su performance e problemi
- **Archiviazione automatica**: Dopo 3 giorni dalla completamento

## ⚙️ Funzioni SQL Avanzate

### **Trigger Statistiche Real-time**
```sql
CREATE OR REPLACE FUNCTION aggiorna_statistiche_follow_up()
RETURNS TRIGGER AS $$
-- Ricalcola automaticamente tutte le statistiche quando cambia lo stato di una chiamata
```

### **Funzione Calcolo Priorità**
```sql
CREATE OR REPLACE FUNCTION calcola_priorita_follow_up(
    prezzo_finale DECIMAL,
    tipo_lavorazione TEXT,
    ha_primo_acquisto_lac BOOLEAN
) RETURNS TEXT
-- Implementa logica di prioritizzazione direttamente nel database
```

### **Funzione Archiviazione Automatica**
```sql
CREATE OR REPLACE FUNCTION archivia_chiamate_completate()
RETURNS INTEGER
-- Da eseguire con cron job per archiviare chiamate dopo 3 giorni
```

## 🔄 Integrazione Sistema Esistente

### **Dashboard Principale**
- Aggiunto pulsante **"Follow-up"** in `DashboardActions.tsx`
- Icona telefono con colore emerald per distinguersi
- Posizionato prima delle note Telegram per priorità visiva

### **Database Types**
- Aggiornato `database.types.ts` con nuove tabelle
- Supporto completo TypeScript per type safety
- Relazioni definite con foreign keys

### **Autenticazione**
- Tutte le API protette da autenticazione Supabase
- Controllo user session per operazioni sensibili
- RLS (Row Level Security) applicabile se necessario

## 🚀 Stato Attuale e Prossimi Passi

### ✅ **Completato**
1. ✅ **Migrazione Database** - Tabelle, trigger, funzioni create
2. ✅ **API Backend** - Tutti gli endpoint funzionanti e testati
3. ✅ **Interfaccia Utente** - Pagina completa con tutti i componenti
4. ✅ **Integrazione Dashboard** - Link accessibile dal menu principale
5. ✅ **Logica Business** - Prioritizzazione e workflow implementati
6. ✅ **Sistema Statistiche** - Dashboard analytics real-time

### 🔄 **Prossimi Sviluppi Pianificati**

#### **Fase 2: Sistema WhatsApp** (Priorità Media)
- Implementare messaggi automatici per Occhiali da Sole 100-400€
- Template personalizzati con nome cliente e brand
- Gestione risposte e sentiment analysis

#### **Fase 3: Automazione Avanzata** (Priorità Bassa)
- Cron job per generazione automatica liste
- Email notification per operatori
- Integrazione calendario per richiamata programmate

#### **Fase 4: Analytics Avanzati** (Futuro)
- Report mensili performance
- Trend analysis soddisfazione clienti
- Predizione problemi da sentiment patterns

## 📊 Metriche di Successo

Il sistema è progettato per tracciare automaticamente:

- **Tasso di Completamento**: % chiamate effettivamente completate
- **Tasso di Soddisfazione**: % clienti soddisfatti/molto soddisfatti
- **Problemi Tecnici**: Numeri errati, staccati (da aggiornare database clienti)
- **Performance Operatori**: Chiamate/ora, qualità conversazioni
- **ROI Follow-up**: Correlazione con recensioni positive e clienti ricorrenti

## 🛠️ Manutenzione

### **Monitoraggio Quotidiano**
- Verificare generazione corretta liste giornaliere
- Controllo performance API (response time <500ms)
- Monitoraggio errori logs per chiamate fallite

### **Manutenzione Settimanale**
- Esecuzione `archivia_chiamate_completate()` se non automatizzata
- Review statistiche per identificare pattern problematici
- Pulizia database da record molto vecchi se necessario

### **Aggiornamenti Periodici**
- Aggiornamento database types quando cambiano schemi Supabase
- Refresh dei template WhatsApp basati su feedback operatori
- Ottimizzazione query se performance degradano con volume

---

## 💡 Note Tecniche

**Tecnologie Utilizzate:**
- Next.js 14 con App Router
- Supabase per database e autenticazione
- TypeScript per type safety completa
- Tailwind CSS per styling responsivo
- React Hooks per state management

**Architettura:**
- Server-side rendering per SEO e performance
- API Routes protette con middleware auth
- Client-side state management con SWR pattern
- Real-time updates tramite trigger database

**Sicurezza:**
- Tutte le API protette da autenticazione
- Validation input lato server e client
- Sanitizzazione dati prima di inserimento database
- Rate limiting implicito tramite autenticazione Supabase

---

*Sistema pronto per produzione e testing con utenti reali.*