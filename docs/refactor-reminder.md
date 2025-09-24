# Refactor Reminder

Elenco delle aree ancora critiche (non SQL) evidenziate dal report "13-reliability" con note sul motivo del refactor e suggerimenti di approccio.

## API Routes
- `src/app/api/voice-notes/[id]/route.ts`
  - **Perché**: funzioni ancora complesse e con numerosi rami condizionali; occorre completare la divisione in helper e coprire interamente i casi redo/append.
  - **Idea**: isolare gli step (autorizzazione, aggiornamento nota, gestione busta) e aggiungere test/telemetria mirata.
- `src/app/api/telegram/webhook/route.ts`
  - **Perché**: cognitive complexity elevata; molte responsabilità (auth, download file, trascrizione, risposta Telegram).
  - **Idea**: spostare la logica in servizi riusabili (`telegramService`, `voiceNoteService`) e aggiungere circuit breaker per AssemblyAI.
- `src/app/api/search/advanced/route.ts`
  - **Perché**: complessa combinazione di ricerche "cliente/prodotto/fornitore" (anche se già semplificata); monitorare ulteriori ottimizzazioni e caching.
  - **Idea**: valutare l'esportazione dei blocchi di query in moduli separati e aggiungere tipizzazione forte sui risultati.

## Auth Pages
- `src/app/auth/callback/route.ts`
  - **Perché**: funzione GET storicamente soggetta a branching; ora modulata ma da validare con scenari OAuth/Invite.
  - **Idea**: copertura test end-to-end per i percorsi `next`, gestione errori e sincronizzazione ruolo.
- `src/app/auth/confirm/page.tsx`
  - **Perché**: refactor completato; tenere monitorati eventuali edge case (token mancanti, parametri extra) e valutare fallback lato server.

## UI & Dashboard Components
- `src/app/dashboard/voice-notes/page.tsx`
  - **Perché**: nesting oltre 4 livelli (hook, fetch, modali) e logica di playback note; rischio regressioni.
  - **Idea**: estrarre hook per playback/download e componenti presentazionali per la lista.
- `src/app/modules/marketing/_components/MarketingClient.tsx`
  - **Perché**: molte funzioni annidate per filtri/email marketing.
  - **Idea**: separare form filter, modale invio e risultati in componenti dedicati.
- `src/app/modules/reactivation/_components/ReactivationClient.tsx`
  - **Perché**: pattern simile a Marketing; logica di pianificazione chiamate centralizzata.
  - **Idea**: creare hook per data fetching/statistiche e componenti per tab.
- `src/app/profile/page.tsx`
  - **Perché**: funzione con complessità elevata (gestione preferenze, avatar, sicurezza).
  - **Idea**: dividere sezioni "Profilo", "Impostazioni sicurezza" in componenti figlio con hook condivisi.
- `src/app/dashboard/_components/BustaCard.tsx`
  - **Perché**: card con molte condizioni e tooltip inline.
  - **Idea**: estrarre sottocomponenti (Badge stato, Azioni rapide) e memorizzare la formattazione.
- `src/app/dashboard/_components/MultiStepBustaForm.tsx`
  - **Perché**: multi-step form con validazioni e creazione cliente/busta nello stesso file.
  - **Idea**: creare hook `useBustaForm` e componenti per sezione cliente/pagamenti.
- `src/app/dashboard/_components/UserProfileHeader.tsx`
  - **Perché**: calcolo di stato utente, azioni veloci e modali nello stesso componente.
  - **Idea**: spostare la logica in hook + componenti minori (es. `UserStats`, `QuickActions`).
- `src/app/dashboard/buste/[id]/_components/PaymentPlanSetup.tsx`
  - **Perché**: complessità residua nella gestione rate/promemoria (già migliorata ma ancora verbose).
  - **Idea**: creare componenti `PaymentOptionCard` e `ReminderOptionCard` riusabili.
- `src/app/dashboard/buste/[id]/_components/tabs/AnagraficaTab.tsx`
  - **Perché**: tab con molte sezioni e moduli di update.
  - **Idea**: dividere per blocchi logici (dati cliente, stato, timeline) e usare hook per fetch/update.
- `src/app/dashboard/buste/[id]/_components/tabs/PagamentoTab.tsx`
  - **Perché**: funzione lunga (balance check, grafici, riepiloghi).
  - **Idea**: estrarre funzioni di calcolo e componenti per timeline pagamenti e summary.

## Varia
- `src/app/dashboard/voice-notes/page.tsx`, `MarketingClient.tsx`, `ReactivationClient.tsx` applicano pattern simili: valutare una volta completato uno per replicare.
- Monitorare `src/app/api/voice-notes/[id]/route.ts` dopo l’ultimo refactor: ulteriori semplificazioni possibili (ad esempio spostando transcribe/update in servizi condivisi con il webhook).

> Nota: gli script SQL non sono stati inclusi (per richiesta esplicita). Questo promemoria si focalizza sui refactor applicativi.
