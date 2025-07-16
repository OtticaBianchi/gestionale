# Istruzioni per Claude Code
Questo file fornisce una guida completa a Claude Code per il progetto attuale (Gestionale Ottica Bianchi). Claude, fai riferimento a queste istruzioni ogni volta che ricevi un nuovo prompt.

## Panoramica del Progetto
Il Gestionale Ottica Bianchi è un software web (ospitato in un sottodominio del sito otticabianchispezia.it su Squarespace) che digitalizza la gestione completa degli ordini (“buste”) in un negozio di ottica (Ottica Bianchi), sostituendo totalmente il cartaceo, fogi Excel e le procedure manuali. Consente agli operatori di seguire ogni pratica cliente dall’apertura alla consegna finale, con una piattaforma Kanban interattiva, note, reminder e workflow controllato. L’obiettivo: efficienza, tracciabilità, riduzione errori e scalabilità.

2. Architettura e logica sottostante
Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS. Interfaccia Kanban drag&drop, responsive e mobile-friendly.

Backend: Supabase (PostgreSQL + Auth + Row Level Security). Tutti i dati (clienti, buste, ordini, note, storico stati) sono strutturati e sicuri, con multi-utenza e permessi granulari.

**Design Pattern**: Adotta un approccio basato su **componenti riutilizzabili** e una chiara separazione delle responsabilità tra frontend, backend e logica AI.

Principali entità database:
buste: cuore del sistema, ogni ordine cliente, 7 fasi workflow, collegato a cliente e operatore.
clienti: anagrafica dettagliata, storico ordini, sistema anti-duplicati.
ordini_materiali: tracciamento acquisti presso fornitori, stati di avanzamento.
Storico stati, note e fornitori.

*   **Input**: Ogni cliente che acquista un prodotto da Ottica Bianchi verrà inserito nell'app ed il suo processo d'acquisto (busta) verrà tracciato fino alla conclusione con consegna e pagamento del dovuto.
*   **Funzionalità Core**: una kanban board che tiene traccia di tutte le fasi del processo per ogni percorso d'acquisto di un cliente, dall'anarafica iniziale, all'ordine dei materiali necessari, alle eventuali lavorazioni, alle comunicazioni con clienti o fornitori, alla consegna e pagamento (in varie soluzioni).
*   **Output**: Modalità di tracciamento di ogni apsetto del percorso di vendita così da ridurre al minimo errori, dimenticanze, ritardi.
*   **Design**: L'interfaccia utente sarà pulita, focalizzata su una kanban board. Sarà prioritaria la velocità di caricamento, la stabilità dell'app, la responsività mobile e l'inclusione di indicatori di progresso.

## Comandi di Sviluppo Necessari

Claude, tieni a mente i seguenti comandi comuni che potresti dover utilizzare o consigliare all'utente:

*   **Installazione Dipendenze**: `npm install` [16].
*   **Avvio Sviluppo Locale**: `npm run dev` o `npm start` [17, 18].
*   **Configurazione Claude Code**: `slash config` per accedere alle impostazioni di configurazione [19].
*   **Cambio Modello**: `slash mod [nome_modello]` (es. `slash mod opus`, `slash mod sonnet`) [20].
*   **Gestione Contesto**: `slash clear` per resettare la finestra di contesto e ridurre allucinazioni/costi [21].
*   **Inizializzazione Progetto**: `slash init` per configurare un nuovo progetto [9].
*   **Comandi Git**: Se necessario, puoi guidare l'utente nell'uso di comandi Git per il versionamento del codice (es. `git push`, `git commit`) [22, 23].

## Idee Architetturali

Claude, segui le seguenti linee guida architetturali per questo progetto:

*   **Frontend**: Utilizza **Next.js 14+ con TypeScript e l'App Router** per una struttura moderna e scalabile [24]. Presta attenzione all'implementazione di HTML, CSS e JavaScript puliti e modulari [25, 26].
*   **Backend / Database**: Integra **Supabase** per la gestione del database e l'autenticazione, sfruttando le sue funzionalità integrate [27].
*   **Integrazioni API**: Per l'analisi dei commenti e la generazione AI, utilizzeremo le **API di YouTube Data v3** e le **API di OpenAI** [12, 16, 28]. Assicurati che le API key siano gestite in modo sicuro, preferibilmente tramite variabili d'ambiente (`.env` file) e mai esposte nel frontend [16, 21, 28].
*   **Design Pattern**: Adotta un approccio basato su **componenti riutilizzabili** e una chiara separazione delle responsabilità tra frontend, backend ed eventuale logica AI.
*   **UI/UX**: Quando si tratta di UI, fai riferimento a screenshot forniti o cerca di replicare l'estetica di piattaforme moderne di project management come Trello.

---

## Regole Fondamentali per Claude Code

Queste sette regole sono state ottimizzate per mesi di utilizzo intensivo e sono considerate le migliori per ottenere codice di alta qualità e senza bug, istruendo Claude Code a "pensare per compiti" (think in tasks) [4, 7, 31].

1.  **Pensa al problema:**
    Claude, prima di procedere, analizza e comprendi a fondo il problema o la richiesta. Questo previene soluzioni superficiali o incomplete, assicurando che l'output sia mirato e pertinente al contesto [7].

2.  **Leggi il codebase per i file pertinenti e scrivi un piano in `project plan.md`:**
    Devi leggere i file esistenti del progetto per comprendere il contesto e mantenere la coerenza del codice. Successivamente, crea un piano di progetto dettagliato nel file `project plan.md`, includendo una lista di attività ("to-do items") che possono essere spuntate man mano che vengono completate. Claude Code sarà in grado di leggere questo piano per riprendere il lavoro da dove si era interrotto [6, 7]. Questo piano serve come roadmap, guidando le tue azioni passo dopo passo e garantendo che tu segua una logica predefinita [7].

3.  **Prima di iniziare a lavorare, confrontati con me e io verificherò il piano:**
    Una volta creato il piano, devi presentarlo all'utente per la revisione e l'approvazione prima di apportare qualsiasi modifica al codice. Questo è fondamentale per mantenere il controllo e assicurare che le tue azioni siano allineate con la visione del progetto.

4.  **Inizia a lavorare sugli elementi to-do:**
    Dopo l'approvazione del piano, procedi sistematicamente con i compiti definiti nel `project plan.md`, spuntando gli elementi completati. Questo assicura un progresso lineare e mirato nello sviluppo.

5.  **Ad ogni passo, dammi una spiegazione di alto livello delle modifiche che hai apportato:**
    Fornisci trasparenza su ogni tua azione. Devi spiegare il ragionamento dietro le modifiche, aiutando l'utente a comprendere il processo e a identificare rapidamente eventuali discrepanze.

6.  **Rendi ogni attività e modifica di codice il più semplice possibile; ogni modifica dovrebbe avere il minor impatto possibile sul codice; tutto è questione di semplicità:**
    Questo ti istruisce a scrivere codice pulito, modulare e con dipendenze minime. Ridurre l'impatto di ogni modifica minimizza il rischio di effetti collaterali indesiderati in altre parti dell'applicazione, contribuendo a mantenere la coerenza e la stabilità del sistema. Questa regola è cruciale per la qualità del codice e la riduzione dei bug [4, 31].

7.  **Aggiungi una sezione di revisione al file `project plan.md` con un riepilogo delle modifiche che hai apportato e qualsiasi altra informazione rilevante:**
    Documenta dettagliatamente il lavoro svolto. Questa sezione è essenziale per la tracciabilità, la manutenzione futura e per comprendere lo stato del progetto.

L'applicazione di queste sette regole, soprattutto in combinazione con l'uso della **modalità di pianificazione (`plan mode`)** di Claude Code, può portare a risultati "impeccabili" e "senza errori". Questo approccio costringe Claude a suddividere ogni attività in blocchi più piccoli e gestibili, garantendo la produzione di codice della migliore qualità possibile e una significativa riduzione dei budget. È stato osservato che, con queste regole, Claude Code può non generare un singolo bug per mesi.

Problema Principale
Fix sincronizzazione dashboard: la Kanban spesso non mantiene gli aggiornamenti dopo cambi in dettaglio busta (problema di cache/sync, serve refetch dati o abilitare real-time subscriptions).
Esempio classico:
1. Creo busta nuova
2. Busta compare nella kanban board nella prima colonna "nuove"
3. Voglio inserire l'ordine fatto dal cliente, sposto la busta da "nuove" a "ordini e materiali" e poi clicco sulla busta per inserire il nuovo ordine  cui verrà associato lo stato di "da ordinare".
4. Ritorno alla dashboard ed ecco il problema: la busta è di nuovo nella prima colonna sotto "nuove" (è tronata indietro!)
5. Se però faccio refresh page (F5), la busta torna al suo posto (nella seconda colonna) con l'ordine "da ordinare" in evidenza.
Chiaramente non posso lasciare che questo accada ogni volta, in quanto comporterebbe un'eccessiva instabilità, insicurezza e complessità operativa che sono esattamente il contrario di ciò che vogliamo contraddistingua la nostra app gestionale.
