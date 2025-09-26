-- Seed script for procedures based on existing files in procedure_personale/
-- Run this after the procedures_migration.sql

-- Insert the existing procedures from the procedure_personale folder

-- 1. Procedura Introduttiva
INSERT INTO procedures (
  title,
  slug,
  description,
  content,
  context_category,
  procedure_type,
  target_roles,
  search_tags,
  is_featured,
  mini_help_title,
  mini_help_summary,
  mini_help_action,
  last_reviewed_at
) VALUES (
  'Procedura Introduttiva – Benvenuto in Ottica Bianchi',
  'procedura-introduttiva-benvenuto',
  'Trasmettere a chi entra in OB la storia, la missione e i valori che hanno reso l''azienda un punto di riferimento a La Spezia dal 1962.',
  '# Procedura Introduttiva – Benvenuto in Ottica Bianchi

## 1. Scopo

Trasmettere a chi entra in OB (nuovi collaboratori o chi sta perdendo di vista i principi fondanti) la storia, la missione e i valori che hanno reso l''azienda un punto di riferimento a La Spezia dal 1962.

## 2. Quando applicarla

- Al primo giorno di ingresso in azienda.
- Ogni volta che un collaboratore mostra di aver dimenticato o trascurato i valori che contraddistinguono OB.

## 3. Chi è responsabile

Tutti i dipendenti, senza eccezioni.
Dal momento in cui entri in negozio ogni giorno, sei **responsabile e custode** dei valori, della storia e della qualità di OB.
Chi se ne discosta deve essere aiutato dai colleghi o dalla direzione a riallinearsi.

## 4. Checklist operativa

- [ ] **Storia**: ricordare che OB opera da oltre 63 anni a La Spezia. Ha sempre operato nel centro storico ed è un punto di riferimento per la città.
- [ ] **Missione**: risolvere i problemi visivi delle persone con **competenza, onestà, gentilezza e solerzia**.
- [ ] **Posizionamento**: ottica premium con clientela fidelizzata, prezzi non bassi, ma competenze e servizio al massimo livello.
- [ ] **Valori**: accoglienza familiare, attenzione alla persona, precisione, formazione continua, onestà, cura del cliente post vendita e ricerca costante del miglioramento.
- [ ] **Procedure**: ogni procedura va conosciuta e rispettata. Sono il nostro strumento di coerenza e qualità: non un optional.

## 5. Cosa NON fare

- ❌ Considerare il cliente un problema di cui liberarsi in fretta.
- ❌ Pensare che qualcun altro sia responsabile dei valori al posto tuo.
- ❌ Vivere le procedure come un peso invece che come garanzia di qualità.
- ❌ Trascurare ordine, pulizia, precisione: ogni dettaglio parla del nostro livello.

## 6. Indicatori di qualità

- Ogni collaboratore sa spiegare in poche frasi storia, missione e posizionamento di OB.
- Nei comportamenti quotidiani emerge coerenza con i valori dichiarati.
- Colleghi e direzione intervengono subito in caso di atteggiamenti contrari alla filosofia aziendale.

## 7. Note pratiche

- Non serve un discorso lungo o teorico: basta saper sintetizzare e incarnare ogni giorno questi principi.
- Ricorda: **sei tu, con i tuoi gesti e parole, la prima pubblicità di OB**.

## 8. Revisione

- Ultima revisione: 24/09/2025
- Responsabile aggiornamento: tutti i dipendenti',
  'accoglienza',
  'formazione',
  ARRAY['addetti_vendita', 'optometrista', 'titolare', 'manager_responsabile', 'laboratorio', 'responsabile_sport'],
  ARRAY['benvenuto', 'valori', 'mission', 'storia', 'onboarding'],
  true,
  'Benvenuto in OB',
  'OB è premium da 63 anni grazie a competenza, onestà e gentilezza.',
  'Ricorda storia, missione, posizionamento e valori. Le procedure non sono un optional.',
  '2025-09-24'
);

-- 2. Procedura Creazione Busta Lavoro
INSERT INTO procedures (
  title,
  slug,
  description,
  content,
  context_category,
  procedure_type,
  target_roles,
  search_tags,
  is_featured,
  mini_help_title,
  mini_help_summary,
  mini_help_action,
  last_reviewed_at
) VALUES (
  'Procedura Creazione Busta Lavoro',
  'procedura-creazione-busta-lavoro',
  'Garantire che ogni busta lavoro sia creata solo con documenti e materiali completi, evitando errori di abbinamento.',
  '# Procedura Creazione Busta Lavoro

## 1. Scopo

Garantire che ogni busta lavoro sia creata solo con documenti e materiali completi, evitando errori di abbinamento tra montatura, lenti e astuccio, e mantenendo la piena tracciabilità.

## 2. Quando applicarla

Al momento della compilazione di una nuova busta lavoro, prima di ogni lavorazione.

## 3. Chi è responsabile

Addetti vendita.

## 4. Checklist operativa

- [ ] **Verifica documentale**:
  - Scheda cliente completa.
  - Prescrizione aggiornata e leggibile.
  - Preventivo approvato dal cliente.
  - Dati di centratura (interpupillare, altezza, ecc.).
  - Ordine lenti compilato.
  - Codice a barre lenti (dal file Excel fornito dal consulente, presente su desktop PC).

- [ ] **Preparazione materiale**:
  - Montatura corretta selezionata.
  - Astuccio prelevato e pronto.
  - Controllo corrispondenza: tagliandino prezzo e codice a barre della montatura devono coincidere con l''astuccio.

- [ ] **Doppio controllo**:
  - Obbligatorio sparare con lettore il codice a barre dell''astuccio.
  - Obiettivi:
    - Confermare che l''astuccio appartenga al modello corretto.
    - Evitare errori di prelievo.
    - Garantire corrispondenza perfetta tra montatura, astuccio e busta lavoro.
    - Mantenere ordine nel magazzino astucci.

- [ ] **Compilazione busta lavoro**:
  - Avviare compilazione **solo se** tutti i controlli precedenti sono stati completati e validati.

## 5. Cosa NON fare

- ❌ Saltare il doppio controllo.
- ❌ Compilare la busta senza preventivo approvato.
- ❌ Consegnare montatura con astuccio di brand diverso.

## 6. Indicatori di qualità

- Zero errori nella corrispondenza montatura–astuccio.
- 100% delle buste validate con doppio controllo barcode.

## 7. Note pratiche

- In caso di incongruenze, interrompere subito la compilazione e correggere prima di procedere.

## 8. Revisione

- Ultima revisione: 26/09/2025
- Responsabile aggiornamento: Tutti',
  'lavorazioni',
  'checklist',
  ARRAY['addetti_vendita'],
  ARRAY['busta', 'lavoro', 'materiali', 'controllo', 'barcode'],
  true,
  'Creazione Busta Lavoro',
  'documenti completi + materiale pronto + doppio controllo barcode → poi compila la busta.',
  'verifica scheda cliente → controlla montatura/astuccio → spara barcode → compila.',
  '2025-09-26'
);

-- 3. Gestione Pause
INSERT INTO procedures (
  title,
  slug,
  description,
  content,
  context_category,
  procedure_type,
  target_roles,
  search_tags,
  is_featured,
  mini_help_title,
  mini_help_summary,
  mini_help_action,
  last_reviewed_at
) VALUES (
  'Gestione Pause',
  'gestione-pause',
  'Definire modalità e limiti di utilizzo delle pause lavorative, nel rispetto della normativa vigente.',
  '# Gestione Pause

## 1. Scopo

Definire modalità e limiti di utilizzo delle pause lavorative, nel rispetto della normativa vigente e delle esigenze operative di OB.

## 2. Quando applicarla

Per tutti i turni di lavoro superiori a 6 ore consecutive.

## 3. Chi è responsabile

- Lavoratori: corretta gestione della propria pausa.
- Manager responsabile: verifica del rispetto della procedura.

## 4. Checklist operativa

- [ ] Ogni dipendente ha diritto ad una pausa di **10 minuti non retribuiti** ogni 6 ore di lavoro.
- [ ] La pausa deve essere collocata in accordo con le esigenze del processo lavorativo.
- [ ] Nella pausa unica sono comprese tutte le attività che sospendono il lavoro (caffè, sigaretta, telefono, merenda, ecc.).
- [ ] Pausa = interruzione dal lavoro → va registrata o comunicata se prolungata.
- [ ] Necessità fisiologiche normali non contano come pausa.
- [ ] Uso telefono personale = pausa, salvo per esigenze strettamente lavorative.

## 5. Cosa NON fare

- ❌ Fare più interruzioni non autorizzate oltre i 10 minuti.
- ❌ Usare il telefono in bagno (considerata pausa non ammessa).
- ❌ Considerare la pausa come retribuita.

## 6. Indicatori di qualità

- Pausa sempre di max 10 minuti.
- Nessuna interruzione extra non recuperata.

## 7. Note pratiche

- Eventuali pause aggiuntive devono essere recuperate restando oltre l''orario.

## 8. Revisione

- Ultima revisione: 26/09/2025
- Responsabile aggiornamento: Manager responsabile',
  'amministrazione',
  'istruzioni',
  ARRAY['manager_responsabile', 'addetti_vendita'],
  ARRAY['pause', 'orario', 'regolamento', 'break'],
  false,
  'Pausa Lavorativa',
  '10 minuti ogni 6 ore, non retribuiti, una sola pausa.',
  'concorda l''orario → sospendi 10 minuti → rientra.',
  '2025-09-26'
);

-- 4. Consegna Occhiali con Lenti Progressive
INSERT INTO procedures (
  title,
  slug,
  description,
  content,
  context_category,
  procedure_type,
  target_roles,
  search_tags,
  is_featured,
  mini_help_title,
  mini_help_summary,
  mini_help_action,
  last_reviewed_at
) VALUES (
  'Consegna Occhiali con Lenti Progressive',
  'consegna-occhiali-lenti-progressive',
  'Accompagnare il cliente al primo utilizzo delle lenti progressive riducendo spaesamento e insoddisfazioni.',
  '# Consegna Occhiali con Lenti Progressive

## 1. Scopo

Accompagnare il cliente al primo utilizzo delle lenti progressive riducendo spaesamento e insoddisfazioni, tramite regolazioni precise dell''occhiale e istruzioni d''uso chiare.

## 2. Quando applicarla

Alla consegna di occhiali con lenti progressive (primo acquisto o sostituzione).

## 3. Chi è responsabile

Addetti vendita.

## 4. Checklist operativa

- [ ] **Postura cliente:** far accomodare il cliente **seduto** su sedia stabile, schiena dritta, sguardo all''orizzonte.
- [ ] **Assetto montatura:** verificare e regolare **appoggio nasale**, **orizzontalità** e **simmetria**; controllare **inclinazione pantoscopica** e **distanza vertice** coerenti con la centratura rilevata.
- [ ] **Allineamento visivo:** con luce frontale, far fissare un punto a 4–5 m e verificare che lo sguardo passi nel **canale di progressione**; micro-regolazioni se necessario.
- [ ] **Spiegazione essenziale di funzionamento:**
  - **Lontano:** testa e occhi in avanti, guardare attraverso la **zona alta**.
  - **Intermedio (PC):** abbassare leggermente lo sguardo, spostare **la testa** per cercare la zona nitida, non gli occhi ai lati.
  - **Vicino (lettura):** abbassare maggiormente lo sguardo usando la **zona bassa**.
  - **Regola d''oro:** **muovere la testa, non solo gli occhi**.
- [ ] **Esercizi guidati da seduti (1–2 minuti):**
  - Cartello/dettaglio lontano → mettere a fuoco.
  - Schermo/oggetto a ~60–70 cm → trovare la finestra nitida ruotando **la testa**.
  - Foglio/telefono a ~35–40 cm → leggere 2–3 righe muovendo **la testa** per seguire la riga.
- [ ] **Attenzioni nelle prime 48 ore:**
  - **Scale e marciapiedi:** scendere **ruotando la testa** verso i gradini, non guardare di lato con la coda dell''occhio.
  - **Auto:** se prima esperienza, evitare tragitti lunghi immediati; iniziare con brevi percorrenze diurne.
  - **PC:** top schermo **poco sotto** la linea degli occhi; distanza ~60–70 cm.
- [ ] **Adattamento atteso e istruzioni d''uso:**
  - Abituazione tipica in **2–7 giorni** (a volte 2–3 settimane).
  - Indossare gli occhiali **continuativamente** per favorire l''adattamento; evitare "on/off" con vecchi occhiali.
- [ ] **Conferma comfort da seduti:** chiedere percezione di nitidezza su lontano/intermedio/vicino; se necessario micro-regolazioni di montatura.
- [ ] **Consegna e materiali:** panno e istruzioni pulizia; indicazioni su custodia e manutenzione.
- [ ] **Follow-up programmato:** fissare controllo gratuito di adattamento a **7–10 giorni**; indicare contatto rapido in caso di nausea/visione instabile persistente.

## 5. Cosa NON fare

- ❌ **Consegnare in piedi** o senza regolazioni fini della montatura.
- ❌ Dire al cliente di "usare gli occhi ai lati" per cercare nitidezza; va **ruotata la testa**.
- ❌ Negare il possibile "effetto onde/nuoto" iniziale; va normalizzato e spiegato come superarlo.
- ❌ Lasciare il cliente senza prova guidata di lontano/intermedio/vicino.
- ❌ Promettere adattamento istantaneo o sminuire disagi persistenti oltre 10–14 giorni.

## 6. Indicatori di qualità

- Cliente esegue correttamente i 3 **compiti da seduto** (lontano, intermedio, vicino) prima di uscire.
- Regolazioni stabili, assenza di pressioni/instabilità segnalate a fine consegna.
- Tasso di ritorni per "non adattamento" **< 5%**; richieste di ritaratura risolte in un singolo intervento.

## 7. Note pratiche

- **Progressive di prima adozione:** insistere sull''uso continuo nei primi giorni.
- **Utilizzo al PC prolungato:** valutare accessorio dedicato (occupazionale) se il cliente lavora molte ore al monitor.
- La maggior parte dei disagi deriva da **assetto montatura non ottimale**: rifare controlli meccanici prima di ipotizzare problemi ottici.

## 8. Revisione

- Ultima revisione: 25/09/2025
- Responsabile aggiornamento: Addetti vendita',
  'consegna',
  'istruzioni',
  ARRAY['addetti_vendita'],
  ARRAY['progressive', 'multifocali', 'consegna', 'adattamento', 'regolazione'],
  true,
  'Consegna Progressive',
  'cliente **seduto**, montatura regolata, testa che guida lo sguardo.',
  'prova lontano → intermedio → vicino; fissare follow-up a 7–10 giorni.',
  '2025-09-25'
);

-- 5. Procedura Ricontatto Clienti Lenti Varifocali
INSERT INTO procedures (
  title,
  slug,
  description,
  content,
  context_category,
  procedure_type,
  target_roles,
  search_tags,
  is_featured,
  mini_help_title,
  mini_help_summary,
  mini_help_action,
  last_reviewed_at
) VALUES (
  'Procedura Ricontatto Clienti Lenti Varifocali',
  'ricontatto-clienti-lenti-varifocali',
  'Verificare la soddisfazione dei clienti che hanno acquistato lenti varifocali e assicurare il corretto adattamento.',
  '# Procedura Ricontatto Clienti Lenti Varifocali

## 1. Scopo

Verificare la soddisfazione dei clienti che hanno acquistato lenti varifocali e assicurare il corretto adattamento, riducendo reclami e insoddisfazioni.

## 2. Quando applicarla

Ogni 15 giorni, sulla base della lista clienti fornita da Luxottica (contatto Roberto Orgiu).

## 3. Chi è responsabile

Optometrista + Manager.

## 4. Checklist operativa

- [ ] Accedi a OB Moduli
- [ ] Nel menu di sinistra, sotto Comunicazioni clicca su Follow-up Chiamate
- [ ] Individuare cliente da contattare.
- [ ] Accedi a Focus
- [ ] Verificare chi ha effettuato il controllo e leggere note tecniche.
- [ ] Controllare scheda occhiali: lenti fornite, eventuali sostituzioni, note su difficoltà.
- [ ] Fare telefonata al cliente:
  - chiedere se adattamento è positivo
  - indicare livello di soddisfazione/insoddisfazione complessiva
  - inserire nota esplicativa della situazione e delle azioni intraprese se necessarie
  - ricordare manutenzione e possibilità di visite di controllo
  - se valutazione positiva, chiedere recensione 5 stelle su google inviando whatsapp con link
- [ ] In caso di insoddisfazione:
  - identificare il problema e specificarlo nello spazio note
  - proporre appuntamento per ricontrollo o spiegazioni aggiuntive
- [ ] In caso di richiesta di richiamo, segnare l''orario preferito dal cliente.

## 5. Cosa NON fare

- ❌ Non registrare l''esito.
- ❌ Dare risposte generiche o poco precise.
- ❌ Non risolvere i casi di insoddisfazione.

## 6. Indicatori di qualità

- % di clienti ricontattati sul totale lista (target 100%).
- % di clienti soddisfatti al follow-up > 90%.

## 7. Note pratiche

- In caso di cliente soddisfatto: ricordare che può passare per piccole regolazioni.
- In caso di dubbio, fissare direttamente appuntamento con optometrista.

## 8. Revisione

- Ultima revisione: 26/09/2025
- Responsabile aggiornamento: Optometrista',
  'customer_care',
  'checklist',
  ARRAY['optometrista', 'addetti_vendita'],
  ARRAY['followup', 'varifocali', 'soddisfazione', 'cliente', 'ricontatto'],
  false,
  'Ricontatto Varifocali',
  'ogni 15 giorni lista clienti → chiama → verifica adattamento → registra esito.',
  'apri scheda → chiama cliente → chiedi soddisfazione → chiudi con nota.',
  '2025-09-26'
);

-- Update last_reviewed_by for all procedures (assuming admin user with a default UUID)
-- In a real scenario, you would update this with the actual admin user ID
UPDATE procedures
SET last_reviewed_by = (
  SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
)
WHERE last_reviewed_by IS NULL;