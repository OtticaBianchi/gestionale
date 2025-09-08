# Funzionalità da Implementare - Gestionale Ottica Bianchi

## 📋 Overview
Questo documento descrive le funzionalità mancanti o da migliorare nel sistema gestionale, con dettagli su localizzazione, logica di business e approccio implementativo.

---

## 🔄 1. DUPLICA BUSTA (Voice Triage - PRIORITÀ ALTA)

### 📍 **Dove si trova**
- **File**: `src/app/modules/voice-triage/page.tsx`
- **Componente**: Dropdown "Duplica" nei risultati ricerca clienti
- **Attualmente**: Pulsante presente ma non funzionante

### 🎯 **Cosa deve fare**
Quando l'operatore trova una busta esistente di un cliente e vuole ricreare un ordine simile:

1. **"Duplica Anagrafica"**: 
   - Crea nuova busta con stessi dati cliente
   - Non copia materiali/prodotti dell'ordine precedente
   - Scenario: Cliente torna per un prodotto diverso

2. **"Duplica Anagrafica + Prodotti"**:
   - Crea nuova busta con stessi dati cliente
   - Copia anche tutti i materiali/ordini della busta originale
   - Scenario: Cliente riordina le stesse lenti a contatto

### 🔧 **Logica Implementativa**

#### Database Tables Coinvolte:
```sql
-- Busta principale
buste: id, cliente_id, readable_id, stato_attuale, data_apertura

-- Dati cliente
clienti: id, nome, cognome, telefono, email, indirizzo

-- Materiali/prodotti dell'ordine
materiali: id, busta_id, tipo, descrizione, quantita, prezzo
```

#### API Endpoints da Creare:
1. `POST /api/buste/duplicate` - Duplica solo anagrafica
2. `POST /api/buste/duplicate-full` - Duplica anagrafica + prodotti

#### Flusso Implementativo:
```javascript
// 1. Leggere busta originale
const originalBusta = await getBustaById(originalBustaId)

// 2. Creare nuova busta con stessi dati cliente
const newBusta = await createBusta({
  cliente_id: originalBusta.cliente_id,
  stato_attuale: 'aperta',
  data_apertura: new Date()
})

// 3. Se "Duplica Full" -> copiare anche materiali
if (duplicateProducts) {
  const materials = await getMaterialsByBustaId(originalBustaId)
  for (material of materials) {
    await createMaterial({
      ...material,
      id: undefined, // Nuovo ID
      busta_id: newBusta.id // Nuova busta
    })
  }
}
```

---

## 📱 2. TELEGRAM BOT - MIGLIORAMENTI

### 📍 **Dove si trova**
- **File**: `src/telegram/handlers/voice-simple.js`
- **Status**: ✅ Funzionante di base

### 🎯 **Miglioramenti Suggeriti**

#### A. Riconoscimento Utenti
- **Problema**: Attualmente salva con `telegram_username` generico
- **Soluzione**: Mappatura utenti Telegram → Dipendenti
- **File da creare**: `src/telegram/config/users.js`

```javascript
const userMapping = {
  'TimPasq': { nome: 'Timoteo Pasqualini', ruolo: 'admin' },
  'MarcoBianchi': { nome: 'Marco Bianchi', ruolo: 'operatore' }
}
```

#### B. Comandi Aggiuntivi
- `/status` - Stato delle proprie note vocali
- `/help` - Guida comandi
- `/stats` - Statistiche personali

#### C. Gestione Errori Migliorata
- Retry automatico su errori temporanei
- Notifiche admin su errori critici

---

## 🔍 3. VOICE TRIAGE - MIGLIORAMENTI

### 📍 **Dove si trova**
- **File**: `src/app/modules/voice-triage/page.tsx`
- **Status**: ✅ Funzionante di base

### 🎯 **Funzionalità da Aggiungere**

#### A. Filtri Avanzati
```javascript
// Filtri da implementare:
- Data (range picker)
- Utente Telegram  
- Stato (pending/processed/archived)
- Durata messaggio (min/max secondi)
- Presenza trascrizione
```

#### B. Azioni Batch
- Selezione multipla note vocali
- Archiviazione in batch
- Assegnazione batch a operatore

#### C. Trascrizione Automatica
- **Servizio**: AssemblyAI (già configurato)
- **Trigger**: Automatico al salvataggio o manuale
- **File**: `src/app/api/voice-notes/transcribe/route.ts` (da creare)

---

## 📊 4. DASHBOARD ANALYTICS

### 📍 **Dove si trova**
- **File**: `src/app/dashboard/page.tsx`
- **Status**: Base presente, da ampliare

### 🎯 **Metriche da Aggiungere**

#### Voice Notes Analytics:
- Numero messaggi vocali per giorno/settimana
- Durata media messaggi
- Top utenti per messaggi inviati
- Tempo medio di processamento

#### Business Analytics:
- Buste create da voice notes vs normali
- Conversion rate messaggi vocali → buste
- Prodotti più richiesti via voice

---

## 🔐 5. GESTIONE UTENTI E PERMESSI

### 📍 **Dove si trova**
- **File**: `src/app/admin/users/` (cartella esiste ma vuota)
- **Status**: ❌ Non implementato

### 🎯 **Sistema da Creare**

#### Ruoli:
```javascript
const roles = {
  'admin': ['read', 'write', 'delete', 'user_management'],
  'operatore': ['read', 'write'],
  'viewer': ['read']
}
```

#### Features:
- CRUD utenti
- Assegnazione ruoli
- Log attività utenti
- Reset password

---

## 🌐 6. API IMPROVEMENTS

### 📍 **File Vari**
- `src/app/api/voice-notes/route.ts`
- `src/app/api/buste/route.ts`

### 🎯 **Miglioramenti Necessari**

#### A. Paginazione
- Attualmente: Carica tutto
- Target: Paginazione con limit/offset

#### B. Caching
- Redis per query frequenti
- Cache invalidation su updates

#### C. Rate Limiting
- Protezione endpoint pubblici
- Throttling per utente

---

## 📱 7. PWA ENHANCEMENTS

### 📍 **File**: `src/app/layout.tsx`, `middleware.ts`

### 🎯 **Funzionalità Mobile**
- Notifiche push per nuove voice notes
- Offline mode per visualizzazione
- Installazione app mobile

---

## 🔧 8. DEPLOYMENT E MONITORING

### 📍 **Infrastruttura**

#### A. Environment Management
- `.env.production` separato
- Variabili sensibili su Vercel

#### B. Logging
- Winston/Pino per log strutturati
- Log aggregation (LogTail, Sentry)

#### C. Health Checks
- Endpoint `/api/health`
- Monitoring Telegram webhook
- Database connection checks

---

## 📅 PRIORITÀ IMPLEMENTAZIONE

### 🚀 **FASE 1 - Entro questa settimana**
1. ✅ Fix Bot Telegram (COMPLETATO)
2. 🔄 Duplica Busta (Voice Triage)
3. 📝 Documentazione operatori

### 🎯 **FASE 2 - Prossime 2 settimane**  
1. Trascrizione automatica
2. Filtri avanzati Voice Triage
3. Dashboard analytics

### 🏗️ **FASE 3 - Prossimo mese**
1. Gestione utenti
2. PWA enhancements  
3. Monitoring completo

---

## 💡 NOTE TECNICHE

### Stack Attuale:
- **Frontend**: Next.js 14 + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Hosting**: Vercel
- **AI Services**: AssemblyAI, OpenRouter

### Principi da Seguire:
1. **Semplicità**: Interfacce intuitive per operatori
2. **Robustezza**: Gestione errori completa
3. **Performance**: Caching e ottimizzazioni
4. **Sicurezza**: Validazione input, sanitizzazione
5. **Manutenibilità**: Codice documentato e testabile

---

*Documento creato il 07/09/2025*  
*Ultimo aggiornamento: Voice Triage funzionante, Bot Telegram riparato*