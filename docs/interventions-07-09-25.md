# Interventi e Stato — 07/09/2025

## Sintesi
- Obiettivo: rendere l’app stabile, sicura, veloce; logout dopo 10’ inattività; reset password sempre disponibile; ruolo admin coerente con accesso ai moduli; rimuovere errori bloccanti.
- Esito: applicate correzioni su asset/static, middleware, componenti client/server, timer di inattività, flusso UI reset password e gestione utenti. Persistono problemi sul reset password con link `?code=...` (clic su “Salva nuova password” non effettua l’aggiornamento) e alcune incoerenze di ruolo/profilo che impattano Voice Triage/Console.

---

## Modifiche Applicate (puntuali)
- Icona/Favicon e asset statici
  - Aggiunta `src/app/icon.png` (Next gestisce automaticamente `/icon`/`/favicon`).
  - Evitato 404 e MIME error per Vercel Speed Insights (caricato solo su Vercel).
    - File: `src/app/layout.tsx:31`
  - Middleware escluso per route statiche e `/_vercel` per non interferire con asset/script.
    - File: `middleware.ts:180`

- Errori Server Components (RSC) — “Event handlers cannot be passed…”/Digest 4191923497
  - Spostato l’`onError` dell’immagine avatar in un Client Component dedicato.
    - Nuovo: `src/components/AvatarImage.tsx`
    - Uso: `src/app/hub/page.tsx:83`
  - Spostate azioni errore dashboard in Client Component per evitare handler in RSC.
    - Nuovo: `src/app/dashboard/_components/ErrorActions.tsx`
    - Modifica: `src/app/dashboard/page.tsx`

- Logout per inattività (10 minuti)
  - Timer a 10’ e sign-out automatico; niente kick indesiderati durante l’uso attivo.
    - File: `src/context/UserContext.tsx:142`

- Caricamento profilo: comportamento resiliente
  - Tolto auto-redirect aggressivo dopo timeout; mostra errore e pulsante “Riprova”.
    - File: `src/app/dashboard/_components/UserProfileHeader.tsx`

- Reset Password (UI e flusso base)
  - Link “Password dimenticata?” sempre presente nella pagina di login.
    - File: `src/app/login/page.tsx:146`
  - Pagine dedicate:
    - Invio link: `src/app/reset-password/page.tsx`
    - Imposta nuova password: `src/app/update-password/page.tsx` (gestione `?code=...`, `#type=recovery`, `onAuthStateChange`).

- Gestione utenti (ruoli e cleanup)
  - Pagina admin per lista/modifica ruoli/eliminazione utenti: `/admin/users`.
    - File: `src/app/admin/users/page.tsx` (aggiunta azione Elimina)
  - API admin:
    - Lista: `src/app/api/admin/users/route.ts`
    - Update: `src/app/api/admin/users/[id]/route.ts (PATCH)`
    - Delete: `src/app/api/admin/users/[id]/route.ts (DELETE)`
  - Script opzionale (CLI) per pulizia utenti tranne uno (NON usato in UI):
    - `scripts/prune-users.js`

---

## Problemi Riscontrati e Stato
1) Porta 3000 occupata (EADDRINUSE)
- Sintomo: `listen EADDRINUSE :::3000`.
- Azione: suggerita chiusura PID o start su porta alternativa. Non è una modifica di codice.
- Stato: risolto operativamente durante la sessione.

2) 404 favicon e `_vercel/speed-insights` + MIME text/html
- Sintomo: asset 404, blocco MIME su script.
- Azioni: caricare Speed Insights solo su Vercel; escludere `/_vercel` e statici dal middleware; usare `src/app/icon.png`.
- Stato: risolto.

3) Errori RSC — “Event handlers cannot be passed to Client Component props” (Digest 4191923497)
- Sintomo: crash in produzione su Server Components.
- Azioni: rimosso `onError` da SC; introdotto `AvatarImage` client e spostate azioni di errore in client.
- Stato: risolto per i punti individuati (Hub header, Dashboard error actions). Possibili altri casi simili non rilevati durante la sessione non risultano nei log attuali.

4) Voice Triage “vede poco” / Console Operativa dà errori
- Causa: ruolo utente non `admin`/`manager` in `public.profiles.role`.
- Azione: chiarita la dipendenza dai ruoli (API filtrano in base al ruolo) e dove aggiornare il ruolo (UI `/admin/users` o SQL in `profiles`).
- Stato: da verificare dopo aver impostato il ruolo corretto sull’utente.

5) Caricamento profilo “infinito”/kick
- Sintomo: header restava in loading o rimandava al login.
- Azioni: resa resiliente la UI (errore + retry, niente redirect forzato su timeout).
- Stato: migliorato; dipende comunque dalla sessione Supabase e dalle policy RLS su `profiles`.

6) Reset password — Link `?code=...` non completa l’aggiornamento
- Sintomo: la pagina “Update Password” prima restava bloccata su “Verifica del link…”, poi (dopo fix) il pulsante “Salva nuova password” non produce effetto percepibile.
- Azioni tentate:
  - Aggiunto flusso `reset-password` (invio link) e `update-password` (set nuova pwd).
  - Gestione `?code=...` con `supabase.auth.exchangeCodeForSession(code)`; gestione hash `#type=recovery&access_token=...`; fallback su sessione; listener `onAuthStateChange`.
- Probabile causa: la sessione non risulta valida dopo l’exchange nel contesto attuale; `updateUser({ password })` richiede sessione. Il link inviato da Supabase per reset su redirect custom potrebbe generare `?code` che, con il provider attuale, non viene scambiato correttamente in questa pagina (oppure l’SDK non restituisce errore intercettabile nel caso osservato). Non riprodotto fino a clic funzionante.
- Stato: NON risolto nella sessione odierna.

---

## Cose NON risolte oggi (esplicito)
- Reset password con link `http://localhost:3000/update-password?code=...`:
  - La pagina mostra il form ma il click su “Salva nuova password” non completa l’aggiornamento per l’utente che ha riportato il problema.
  - Richiede diagnosi mirata dei passi: esito di `exchangeCodeForSession`, presenza sessione (`getSession()`), esito di `updateUser` e relative policy/Auth settings.

- Incoerenze ruolo/profilo che impattano Voice Triage/Console Operativa:
  - Se il ruolo in `profiles` non è aggiornato a `admin`/`manager`, l’utente vede dati parziali e riceve 403/401 su update ordini.

---

## Assunzioni/Prerequisiti di Ambiente usati oggi
- `.env.local` presente con:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
  - Token/chiavi per AssemblyAI/Telegram (non rilevanti per i problemi odierni)
- Supabase Auth Email provider attivo; Redirect URL usati: 
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/update-password`
- Build/avvio: `next build && next start` (prod) e `next dev` (per log più verbosi).

---

## Note per chi prosegue (senza applicare fix ora)
- Reset password:
  - Registrare in console l’esito di `exchangeCodeForSession(code)` e di `updateUser` (errore/successo), e il risultato di `supabase.auth.getSession()` subito prima del salvataggio.
  - Verificare nelle impostazioni Supabase se il flusso di reset in uso emette link con `#type=recovery` (access_token in hash) anziché `?code` e, se sì, adeguare la procedura o indirizzare prima su `/auth/callback?next=/update-password`.
- Ruoli:
  - Verificare RLS e le policy su `public.profiles` (select/update del proprio profilo) per evitare loop di caricamento.

---

Documento creato automaticamente per tracciare attività, errori e stato al termine della sessione del 07/09/2025.
