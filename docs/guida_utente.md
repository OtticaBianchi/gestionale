# Guida Utente – Gestionale Ottico

Questa guida spiega come usare l’applicazione dal punto di vista dell’operatore/manager/admin.

## Accesso e Ruoli
- Admin: gestione utenti, Voice Triage completo, eliminazione note, tutte le funzioni.
- Manager: dashboard, ordini/materiali, fornitori; no eliminazioni distruttive.
- Operatore: uso quotidiano della dashboard e delle buste; niente azioni amministrative.

## Dashboard (Kanban)
- Percorso: `/dashboard`
- Cosa vedi: buste raggruppate per stato (nuove → materiali → lavorazione → pronto ritiro → consegnato).
- Azioni rapide: apri una busta, aggiorna lo stato, cerca/filtra.

## Dettaglio Busta
- Percorso: `/dashboard/buste/[id]`
- Tab principali: Info, Materiali, Pagamenti, Comunicazioni.
- Cosa fai: aggiorni dati cliente e lavorazione, gestisci materiali, registri pagamenti.

## Note Vocali (da Telegram)
- Come inviare: invia un messaggio vocale al bot Telegram aziendale.
- Dove appaiono: pagina Voice Notes/Voice Triage (`/dashboard/voice-notes`).
- Stato iniziale: ogni nota arriva come “In attesa” (pending) e senza trascrizione.

### Ascolto e Download
- Solo gli amministratori possono riprodurre e scaricare l’audio.
- Tutti vedono durata, dimensione e – se presente – la trascrizione.

### Collegamento e Trascrizione (Triage)
- Apri la ricerca (icona viola lente) sulla card della nota.
- Puoi:
  - Collega al Cliente: associa la nota al cliente (non avvia la trascrizione).
  - Collega qui (su una busta): collega la nota a quella busta e avvia automaticamente la trascrizione server‑side. La trascrizione viene salvata nella nota e copiata nelle note della busta (blocco con marcatore).
  - + Nuova Busta: crea una busta per il cliente; dopo la creazione, collega la nota alla nuova busta per ottenere la trascrizione.
- Suggerimento: vedrai un hint vicino ai pulsanti che ricorda che la trascrizione parte quando colleghi a una busta.

### Completamento e Pulizia
- Quando la nota è stata gestita, premi “Segna come completata”.
- Dopo 7 giorni dalla “completata”, l’audio viene rimosso automaticamente per contenere lo spazio; restano i metadati e la trascrizione. Puoi anche eliminare manualmente la nota (admin).

## Ordini e Fornitori
- Filtri Ordini: visualizza e gestisci cosa ordinare e gli arrivi. “Apri portale” ti porta al sito B2B del fornitore (se configurato).
- Gestione Fornitori: in `/modules/fornitori` aggiorni dati e portali dei fornitori.

## Pagamenti
- Registra acconti e saldi nella busta (tab Pagamenti/Materiali). Il riepilogo mostra Totale, Pagato, Residuo e stato.

## Profilo e Utenti
- Profilo personale in `/profile`.
- Se sei admin, gestisci utenti e inviti dalla sezione amministrazione.

## Suggerimenti Rapidi
- Non serve trascrivere tutto: collega la nota a una busta solo quando ti serve il testo.
- Usa “Completata” per innescare la pulizia automatica dopo 7 giorni.
- Se non trovi il cliente, creane uno nuovo e poi collega la nota alla busta.

