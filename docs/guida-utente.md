# 📚 Guida Utente - Gestionale Ottica Bianchi

## 🎯 Panoramica Generale

Il sistema gestionale è organizzato in **due sezioni principali**:

- **🏠 Hub Moduli** - Centro di controllo per Admin/Manager
- **👁️ VisionHUB** - Area operativa quotidiana per tutti gli utenti

---

## 🔐 1. ACCESSO E AUTENTICAZIONE

### Login
1. Vai su `https://[tuo-dominio].vercel.app/login`
2. Inserisci **email** e **password**
3. Clicca **"Accedi"**

### Primo Accesso
- Se non hai un account, contatta l'amministratore
- Al primo login, completa il tuo profilo in **Profilo → Modifica Profilo**

### Ruoli Utente
- **👤 Operatore**: Accesso a VisionHUB (gestione buste quotidiana)
- **👨‍💼 Manager**: Accesso a Hub + VisionHUB + Console Operativa
- **👨‍💻 Admin**: Accesso completo a tutti i moduli

---

## 🏠 2. HUB MODULI (Admin/Manager)

**Accesso**: Dopo login, gli Admin/Manager vedono l'Hub come pagina principale.

### 🔧 Moduli Disponibili

#### 👁️ **VisionHUB**
- **Cosa fa**: Gestione quotidiana buste, kanban, materiali
- **Chi lo usa**: Tutti gli utenti
- **Funzioni**: Creazione buste, tracking ordini, gestione pagamenti

#### 🎙️ **Voice Triage** (Solo Admin)
- **Cosa fa**: Gestione messaggi vocali da Telegram
- **Chi lo usa**: Solo amministratori
- **Funzioni**: Ascolto messaggi, ricerca clienti, collegamento a buste

#### 🚛 **Console Operativa** (Admin/Manager)
- **Cosa fa**: Monitoraggio ordini in corso
- **Chi lo usa**: Admin e Manager
- **Funzioni**: Ordini da fare, in arrivo, in ritardo

#### 📁 **Archivio Buste** (Admin/Manager)
- **Cosa fa**: Consultazione buste consegnate
- **Chi lo usa**: Admin e Manager  
- **Funzioni**: Ricerca storica, reportistica

---

## 👁️ 3. VISIONHUB - GESTIONE QUOTIDIANA

### 🎯 **Dashboard Principale**
**Percorso**: Hub → VisionHUB oppure accesso diretto per operatori

#### **Sezioni Principali**
1. **📊 Statistiche**: Panoramica buste attive, completate, in ritardo
2. **📋 Kanban Board**: Visualizzazione stati buste (Aperte → Pronte → Consegnate)
3. **🔍 Ricerca Rapida**: Trova buste per cliente, ID, telefono
4. **➕ Azioni Rapide**: Nuova busta, ricerca avanzata

### 📝 **Creare una Nuova Busta**

#### **Metodo 1 - Pulsante Principale**
1. Dalla dashboard, clicca **"+ Nuova Busta"**
2. Compila **dati cliente**:
   - Nome, Cognome, Telefono
   - Email (opzionale)
   - Indirizzo (opzionale)
3. Aggiungi **materiali/prodotti**:
   - Descrizione prodotto
   - Quantità
   - Prezzo unitario
4. Clicca **"Crea Busta"**

#### **Metodo 2 - Da Voice Triage**
1. Hub → Voice Triage
2. Ascolta messaggio vocale
3. Cerca cliente esistente
4. Clicca **"+ Nuova Busta"** accanto al cliente

### 🔍 **Ricerca e Gestione Buste**

#### **Ricerca Rapida**
- **Barra di ricerca**: Inserisci nome, cognome o telefono
- **Filtri rapidi**: Per stato (aperte, in lavorazione, pronte)
- **ID Busta**: Cerca per numero busta (es. "2025-0001")

#### **Ricerca Avanzata**
1. Dashboard → **"Ricerca Avanzata"**
2. **Filtri disponibili**:
   - Range di date
   - Stato busta
   - Cliente specifico
   - Importo (min/max)
   - Note contenenti parole chiave

### 📋 **Gestione Singola Busta**

#### **Aprire una Busta**
- Dalla dashboard, clicca sulla **card della busta**
- Oppure usa ricerca e clicca **"Apri"**

#### **Schede (Tab) della Busta**

##### **📋 Anagrafica**
- Visualizza/modifica dati cliente
- Aggiorna telefono, email, indirizzo
- Salva automaticamente le modifiche

##### **📦 Materiali**
- **Aggiungi prodotti**: Descrizione, quantità, prezzo
- **Modifica esistenti**: Clicca sulla riga per editare
- **Elimina**: Usa l'icona cestino
- **Calcolo automatico**: Totale aggiornato in tempo reale

##### **💰 Pagamento**
- **Stato pagamento**: Non pagato / Parziale / Pagato
- **Metodi**: Contanti, Carta, Bonifico, Finanziamento
- **Acconti**: Registra pagamenti parziali
- **Saldo**: Calcolo automatico rimanente

##### **📢 Notifiche**
- **SMS/WhatsApp**: Invia aggiornamenti al cliente
- **Template predefiniti**: "Ordine pronto", "In ritardo", ecc.
- **Personalizza**: Modifica testo prima dell'invio
- **Cronologia**: Vedi tutti i messaggi inviati

##### **🔄 Stato**
- **Cambia stato**: Aperta → In Lavorazione → Pronta → Consegnata
- **Note interne**: Aggiungi commenti per il team
- **Data consegna**: Imposta scadenza
- **Priorità**: Normale, Urgente, Bassa

---

## 🎙️ 4. VOICE TRIAGE - GESTIONE MESSAGGI VOCALI

### 📱 **Bot Telegram - Invio Messaggi**

#### **Per gli Operatori**
1. Cerca **@VisionHUBot** su Telegram
2. Invia `/start` (solo la prima volta)
3. **Invia messaggi vocali** normalmente
4. Il bot conferma il salvataggio

#### **Tipi di Messaggi Gestiti**
- 🎙️ **Messaggi vocali**: Formato supportato
- 🎵 **File audio**: MP3, OGG, WAV
- 📁 **Documenti audio**: File allegati come documenti

### 🎧 **Interfaccia Voice Triage**

#### **Accesso**
Hub → Voice Triage (solo Admin)

#### **Funzionalità Principali**

##### **📝 Lista Messaggi**
- **Ordinamento**: Più recenti in alto
- **Informazioni**: Data, ora, utente, durata
- **Stato**: In attesa, Processato, Archiviato

##### **🎵 Player Audio**
- **Play/Pause**: Controlli intuitivi
- **Durata**: Visualizzazione tempo totale
- **Volume**: Controllo audio

##### **🔍 Ricerca Clienti**
1. **Barra di ricerca**: Inserisci nome/cognome/telefono
2. **Risultati**: Lista clienti con buste associate
3. **Azioni disponibili**:
   - **Visualizza**: Apri busta esistente
   - **+ Nuova Busta**: Crea nuova per questo cliente
   - **Duplica** *(da implementare)*: Replica ordine precedente

##### **📋 Collegamento a Buste**
- **Cliente esistente**: Collega messaggio a busta attiva
- **Nuovo cliente**: Crea anagrafica e busta
- **Note vocali**: Aggiungi trascrizione manuale

---

## 🚛 5. CONSOLE OPERATIVA (Manager/Admin)

### 📊 **Monitoraggio Ordini**

#### **Sezioni**
1. **🔄 Da Fare**: Ordini appena creati
2. **📦 In Arrivo**: Ordini dal fornitore
3. **⏰ In Ritardo**: Ordini oltre scadenza
4. **✅ Completati**: Ordini consegnati oggi

#### **Azioni Rapide**
- **Aggiorna stato**: Click per cambiare fase
- **Contatta cliente**: SMS/WhatsApp automatico
- **Note urgenti**: Evidenzia problemi
- **Priorità**: Riordina per urgenza

---

## 📱 6. FUNZIONI MOBILE E PWA

### 📲 **Installazione App**
1. **Da browser mobile**: Vai sul sito
2. **Menu browser**: Cerca "Aggiungi alla schermata home"
3. **iPhone**: Safari → Condividi → "Aggiungi a Home"
4. **Android**: Chrome → Menu → "Installa app"

### 🔔 **Notifiche Push**
- **Nuovi messaggi vocali**: Alert in tempo reale
- **Buste in scadenza**: Promemoria automatici
- **Stato ordini**: Aggiornamenti fornitori

---

## ⚙️ 7. IMPOSTAZIONI E PROFILO

### 👤 **Gestione Profilo**
**Accesso**: Click icona utente (in alto a destra) → Profilo

#### **Informazioni Personali**
- **Nome completo**: Visualizzato in app
- **Email**: Per login e notifiche
- **Avatar**: Foto profilo personalizzata
- **Telefono**: Contatto interno

#### **Preferenze**
- **Lingua**: Italiano (predefinito)
- **Notifiche**: Email, Push, SMS
- **Dashboard**: Layout predefinito
- **Tema**: Chiaro/Scuro *(futuro)*

### 🔧 **Impostazioni Avanzate**
**Accesso**: Menu → Impostazioni

#### **Sistema**
- **Backup dati**: Download periodico
- **Cache**: Svuota per problemi
- **Aggiornamenti**: Versioni disponibili
- **Supporto**: Contatta assistenza

---

## 🆘 8. RISOLUZIONE PROBLEMI

### ❌ **Problemi Comuni**

#### **Login non funziona**
1. **Verifica credenziali**: Email e password corrette
2. **Reset password**: Link "Password dimenticata"
3. **Cache browser**: Svuota cache e cookies
4. **Contatta admin**: Se persiste il problema

#### **Bot Telegram non risponde**
1. **Verifica bot**: Cerca @VisionHUBot
2. **Restart**: Invia `/start` di nuovo
3. **Formato messaggio**: Solo audio/vocali supportati
4. **Connessione**: Verifica internet

#### **Buste non si caricano**
1. **Ricarica pagina**: F5 o refresh browser
2. **Connessione**: Verifica stabilità internet
3. **Browser supportato**: Chrome, Firefox, Safari aggiornati
4. **JavaScript**: Deve essere abilitato

#### **Voice Triage non funziona**
1. **Permessi audio**: Abilita microfono nel browser
2. **Formato file**: MP3, OGG, WAV supportati
3. **Dimensione**: Max 20MB per file
4. **Browser**: Usa Chrome per compatibilità migliore

### 🔄 **Reset Cache (Problemi Generali)**
1. **Chrome**: Ctrl+Shift+Canc → Seleziona tutto → Cancella
2. **Firefox**: Ctrl+Shift+Canc → Cancella tutto
3. **Safari**: Sviluppo → Svuota cache
4. **Mobile**: Impostazioni app → Archiviazione → Cancella cache

---

## 📞 9. SUPPORTO E CONTATTI

### 🚨 **Assistenza Urgente**
- **Telefono**: [Numero supporto tecnico]
- **WhatsApp**: [Numero WhatsApp]
- **Email**: support@ottibianchi.it

### 🐛 **Segnalazione Bug**
- **In-app**: Menu → Assistenza → Segnala problema
- **Email**: Descrivi il problema + screenshot
- **Telefono**: Per problemi critici

### 💡 **Richieste Funzionalità**
- **Email**: feature-request@ottibianchi.it
- **Descrizione**: Spiega l'esigenza business
- **Priorità**: Indica urgenza (Alta/Media/Bassa)

---

## 📚 10. FORMAZIONE E RISORSE

### 🎓 **Tutorial Video**
- **YouTube**: Canale "OB Gestionale Tutorials"
- **Playlist**: Funzioni base, avanzate, troubleshooting
- **Aggiornamenti**: Nuove funzioni documentate

### 📖 **Documentazione Tecnica**
- **Wiki interno**: Procedure dettagliate
- **Changelog**: Novità per versione
- **FAQ**: Domande frequenti

### 🏃‍♂️ **Quick Start Checklist**

#### **Per Operatori (Primo Giorno)**
- [ ] Login eseguito con successo
- [ ] Profilo completato
- [ ] Prima busta creata
- [ ] Test ricerca cliente
- [ ] Invio prima notifica
- [ ] Bot Telegram configurato

#### **Per Manager/Admin (Primo Giorno)**  
- [ ] Accesso Hub verificato
- [ ] Voice Triage testato
- [ ] Console Operativa consultata
- [ ] Primo messaggio vocale processato
- [ ] Archivio buste esplorato
- [ ] Utenti team verificati

---

## 🔄 **Versione Documento**
- **Versione**: 1.0
- **Data**: 07/09/2025  
- **Ultima modifica**: Setup iniziale Voice Triage + Bot Telegram
- **Prossimo aggiornamento**: Funzioni "Duplica Busta" + Trascrizione automatica

---

*💡 **Suggerimento**: Salva questa guida nei preferiti del browser per accesso rapido durante il lavoro quotidiano.*