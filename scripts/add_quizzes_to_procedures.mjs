#!/usr/bin/env node

/**
 * Add Quiz Sections to Procedure Markdown Files
 *
 * This script adds quiz sections in accordion format to all procedure markdown files
 * based on the quiz data generated from the database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quiz data mapping - matches the SQL seed file
export const QUIZ_DATA = {
  'rispondere-al-telefono': [
    {
      number: 1,
      text: 'Entro quanti squilli bisogna rispondere al telefono secondo la procedura?',
      options: [
        { text: '3 squilli', correct: true },
        { text: '5 squilli', correct: false },
        { text: 'Appena possibile, senza limiti specifici', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Qual è la formula standard corretta per rispondere al telefono?',
      options: [
        { text: '"Sì? Mi dica"', correct: false },
        { text: '"Buongiorno, Ottica Bianchi, sono [Nome]. Come posso aiutarla?"', correct: true },
        { text: '"Pronto, chi parla?"', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente chiama chiedendo informazioni su un ordine. Mentre cerchi nel gestionale, noti che la verifica richiederà almeno 2 minuti. Nel frattempo, un altro cliente entra in negozio. Cosa fai?',
      options: [
        { text: 'Metti il cliente in attesa senza dire nulla e vai ad accogliere chi è entrato', correct: false },
        { text: 'Ignori il cliente in negozio finché non finisci la chiamata', correct: false },
        { text: 'Proponi al cliente una richiamata entro pochi minuti, così puoi verificare con calma e accogliere il nuovo cliente', correct: true }
      ]
    }
  ],
  'conferma-appuntamento': [
    {
      number: 1,
      text: 'Quando va inviato il messaggio di conferma dell\'appuntamento?',
      options: [
        { text: '24 ore prima dell\'appuntamento', correct: true },
        { text: 'Una settimana prima', correct: false },
        { text: 'Il giorno stesso dell\'appuntamento', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se il cliente non risponde al messaggio di conferma entro la mattina dell\'appuntamento?',
      options: [
        { text: 'Aspettare che arrivi senza fare nulla', correct: false },
        { text: 'Verificare telefonicamente', correct: true },
        { text: 'Cancellare automaticamente l\'appuntamento', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Devi confermare un appuntamento per domani. Il cliente è una signora di 78 anni che ha WhatsApp, ma guardando lo storico noti che non ha mai risposto ai messaggi precedenti. Inoltre, sulla scheda c\'è una nota "preferisce essere chiamata". Come ti comporti?',
      options: [
        { text: 'Mandi comunque il messaggio WhatsApp standard perché è la procedura', correct: false },
        { text: 'Non confermi l\'appuntamento perché tanto non risponde mai', correct: false },
        { text: 'Effettui una chiamata diretta, come suggerito dalla nota e dal comportamento passato', correct: true }
      ]
    }
  ],
  'annullamento-riprogrammazione-appuntamento': [
    {
      number: 1,
      text: 'Quando un cliente chiede di spostare un appuntamento, cosa bisogna fare PRIMA?',
      options: [
        { text: 'Verificare la disponibilità in agenda', correct: true },
        { text: 'Proporre subito un nuovo orario', correct: false },
        { text: 'Cancellare l\'appuntamento esistente', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Come va registrato nel gestionale un appuntamento annullato dal cliente?',
      options: [
        { text: 'Eliminarlo completamente', correct: false },
        { text: 'Segnarlo come "Cancellato cliente" con motivazione', correct: true },
        { text: 'Lasciarlo com\'è senza note', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente cancella per la terza volta consecutiva. Quale approccio è corretto?',
      options: [
        { text: 'Rifiutare ulteriori prenotazioni', correct: false },
        { text: 'Accettare normalmente senza segnalazioni', correct: false },
        { text: 'Segnalare al manager per valutazione', correct: true }
      ]
    }
  ],
  'registrazione-appuntamenti': [
    {
      number: 1,
      text: 'Quali informazioni sono OBBLIGATORIE quando si registra un appuntamento?',
      options: [
        { text: 'Nome, cognome, telefono, data/ora, tipo visita', correct: true },
        { text: 'Solo nome e data', correct: false },
        { text: 'Solo telefono e orario', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se due clienti vogliono lo stesso orario?',
      options: [
        { text: 'Accettarli entrambi', correct: false },
        { text: 'Proporre orario alternativo al secondo cliente', correct: true },
        { text: 'Rifiutare il secondo cliente', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente chiama per un controllo urgente. Come gestirlo?',
      options: [
        { text: 'Dirgli di aspettare il primo slot disponibile', correct: false },
        { text: 'Inserirlo in uno slot già occupato', correct: false },
        { text: 'Valutare l\'urgenza e consultare l\'optometrista per eventuale slot extra', correct: true }
      ]
    }
  ],
  'gestione-buoni-regalo': [
    {
      number: 1,
      text: 'Quando si vende un buono regalo, cosa NON si deve fare in Focus 10?',
      options: [
        { text: 'Inserire il buono nel sistema', correct: true },
        { text: 'Rilasciare una ricevuta', correct: false },
        { text: 'Avvisare Enrico', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Quando va emesso lo scontrino fiscale per un buono regalo?',
      options: [
        { text: 'Al momento dell\'acquisto del buono', correct: false },
        { text: 'Al momento dell\'utilizzo del buono', correct: true },
        { text: 'Mai, solo ricevuta', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente presenta un buono regalo scaduto da 15 mesi. Cosa fare?',
      options: [
        { text: 'Accettarlo immediatamente', correct: false },
        { text: 'Rifiutarlo categoricamente', correct: false },
        { text: 'Avvisare Enrico o Valentina per autorizzazione', correct: true }
      ]
    }
  ],
  'gestione-acconti-su-vendita-merce': [
    {
      number: 1,
      text: 'Su quanti livelli deve essere gestito ogni acconto secondo la procedura?',
      options: [
        { text: 'Contemporaneamente su Focus (contabile) e Moduli (operativo)', correct: true },
        { text: 'Solo su Focus', correct: false },
        { text: 'Solo su Moduli', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Come va registrato un acconto nel gestionale?',
      options: [
        { text: 'Come vendita completa', correct: false },
        { text: 'Come acconto con riferimento all\'ordine', correct: true },
        { text: 'Non va registrato fino alla consegna', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Stai chiudendo una vendita per un cliente che aveva versato €200 di acconto un mese fa. Il carrello su Focus non scala l\'acconto e appare un errore bloccante. Verifichi e scopri che l\'acconto era stato registrato con IVA al 22%, ma la fornitura finale è con IVA al 4% (lenti per ipovedente). Cosa fai?',
      options: [
        { text: 'Chiudi comunque la vendita facendo pagare di nuovo l\'intero importo al cliente', correct: false },
        { text: 'Cancelli l\'acconto dal sistema senza dire nulla al cliente', correct: false },
        { text: 'Contatti il manager/titolare per gestire l\'anomalia e correggere l\'errore IVA prima di procedere', correct: true }
      ]
    }
  ],
  'consegna_lenti_progressive': [
    {
      number: 1,
      text: 'Qual è il tempo minimo da dedicare alla consegna di lenti progressive?',
      options: [
        { text: '15-20 minuti', correct: true },
        { text: '5 minuti', correct: false },
        { text: '30 minuti', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa va spiegato PRIMA di far indossare gli occhiali al cliente?',
      options: [
        { text: 'Il prezzo finale', correct: false },
        { text: 'Le zone di visione e il periodo di adattamento', correct: true },
        { text: 'Le istruzioni di pulizia', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Il cliente lamenta visione offuscata laterale con le nuove progressive. Risposta corretta?',
      options: [
        { text: 'Sostituirle immediatamente', correct: false },
        { text: 'Inviarlo da un altro ottico', correct: false },
        { text: 'Spiegare che è normale nelle zone periferiche e serve abitudine', correct: true }
      ]
    }
  ],
  'follow-up_clienti_multifocali': [
    {
      number: 1,
      text: 'Quando va effettuato il primo follow-up dopo consegna di lenti multifocali?',
      options: [
        { text: '7-10 giorni', correct: true },
        { text: '1 mese', correct: false },
        { text: 'Solo se il cliente chiama', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Durante il follow-up, cosa NON bisogna chiedere?',
      options: [
        { text: 'Se ha dolori o fastidi', correct: false },
        { text: 'Se vuole cambiare montatura', correct: true },
        { text: 'Come si trova con la visione da vicino', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Il cliente riferisce mal di testa dopo 5 giorni con le nuove progressive. Azione corretta?',
      options: [
        { text: 'Dirgli di abituarsi ancora', correct: false },
        { text: 'Offrire subito lenti diverse', correct: false },
        { text: 'Fissare controllo con optometrista per verifica centratura e parametri', correct: true }
      ]
    }
  ],
  'azioni-pre-appuntamento-optometrico': [
    {
      number: 1,
      text: 'Quanto tempo prima dell\'appuntamento va preparata la sala refrazione?',
      options: [
        { text: '30 minuti', correct: true },
        { text: '5 minuti', correct: false },
        { text: '1 ora', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa va verificato PRIMA di iniziare la visita?',
      options: [
        { text: 'Solo lo storico del cliente', correct: false },
        { text: 'Scheda cliente, strumenti calibrati, ambiente pronto', correct: true },
        { text: 'Solo la disponibilità dell\'optometrista', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente arriva con 15 minuti di ritardo per il controllo della vista. La sala refrazione è libera, ma l\'optometrista ha un altro appuntamento tra 25 minuti. Inoltre, sulla scheda c\'è scritto "prima esperienza, mai portato occhiali". Come gestisci la situazione?',
      options: [
        { text: 'Fai entrare subito il cliente senza informare l\'optometrista del ritardo', correct: false },
        { text: 'Mandi via il cliente e gli dici di riprogrammare', correct: false },
        { text: 'Avvisi l\'optometrista della situazione, valutate insieme se c\'è tempo sufficiente per un controllo accurato o se proporre riprogrammazione', correct: true }
      ]
    }
  ],
  'busta_lavoro': [
    {
      number: 1,
      text: 'Qual è il primo passo quando si crea una nuova busta lavoro?',
      options: [
        { text: 'Verificare i dati nel gestionale e creare la busta', correct: true },
        { text: 'Stampare l\'etichetta', correct: false },
        { text: 'Chiamare il laboratorio', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa deve contenere SEMPRE una busta lavoro?',
      options: [
        { text: 'Solo la montatura', correct: false },
        { text: 'Scheda con dati cliente, prescrizione, note e montatura', correct: true },
        { text: 'Solo i dati di pagamento', correct: false }
      ]
    },
    {
      number: 3,
      text: 'La busta lavoro di un ordine urgente viene confusa con una normale. Cosa fare?',
      options: [
        { text: 'Ignorare e procedere normalmente', correct: false },
        { text: 'Aspettare che il cliente chiami', correct: false },
        { text: 'Identificarla immediatamente, marcarla come urgente e avvisare il laboratorio', correct: true }
      ]
    }
  ],
  'carico_occhiali_luxottica_stars': [
    {
      number: 1,
      text: 'Dove va registrato il carico degli occhiali Luxottica Stars?',
      options: [
        { text: 'Nel gestionale con codici e quantità', correct: true },
        { text: 'Solo su carta', correct: false },
        { text: 'Solo nel portale Luxottica', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se mancano articoli rispetto al DDT?',
      options: [
        { text: 'Accettare comunque la merce', correct: false },
        { text: 'Annotare le differenze sul DDT e segnalare immediatamente', correct: true },
        { text: 'Rimandare indietro tutto', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un occhiale arriva danneggiato. Procedura corretta?',
      options: [
        { text: 'Rifiutarlo alla consegna', correct: false },
        { text: 'Accettarlo e ripararlo internamente', correct: false },
        { text: 'Fotografare, annotare sul DDT, accettare con riserva e aprire contestazione', correct: true }
      ]
    }
  ],
  'gestione_astucci_montature_luxottica': [
    {
      number: 1,
      text: 'Gli astucci originali Luxottica vanno sempre forniti al cliente?',
      options: [
        { text: 'Sì, sempre', correct: true },
        { text: 'No, mai', correct: false },
        { text: 'Solo su richiesta', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se l\'astuccio originale manca?',
      options: [
        { text: 'Usare un astuccio generico senza avvisare', correct: false },
        { text: 'Segnalare al cliente e proporre alternativa o richiesta al fornitore', correct: true },
        { text: 'Non dare nessun astuccio', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Stai consegnando degli occhiali Ray-Ban a un cliente. Cercando l\'astuccio corrispondente, ti accorgi che non ce ne sono più: sono finiti. Il cliente ha fretta e vuole portare via subito gli occhiali. Come ti comporti?',
      options: [
        { text: 'Gli dai un astuccio di un altro brand senza dire nulla', correct: false },
        { text: 'Gli dici che non può ritirare gli occhiali senza astuccio originale', correct: false },
        { text: 'Informi il cliente della situazione, proponi un astuccio generico temporaneo o la possibilità di tornare quando arriverà quello originale, e segnali la mancanza', correct: true }
      ]
    }
  ],
  'gestione_buoni_dipendenti_luxottica': [
    {
      number: 1,
      text: 'I buoni dipendenti Luxottica hanno scadenza?',
      options: [
        { text: 'Sì, va verificata', correct: true },
        { text: 'No, mai', correct: false },
        { text: 'Solo dopo 2 anni', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa va verificato PRIMA di accettare un buono dipendente?',
      options: [
        { text: 'Solo il nome del dipendente', correct: false },
        { text: 'Validità, importo, prodotti inclusi e documenti richiesti', correct: true },
        { text: 'Solo l\'importo', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un dipendente Luxottica presenta un buono valido e sceglie una montatura Ray-Ban Stories a €350. Verifichi che i Ray-Ban Stories sono esclusi dallo sconto. Il cliente insiste che "il buono copre tutto". Come ti comporti?',
      options: [
        { text: 'Applichi lo sconto comunque per non creare discussioni', correct: false },
        { text: 'Rifiuti la vendita senza offrire alternative', correct: false },
        { text: 'Spieghi gentilmente l\'esclusione e proponi montature alternative compatibili, oppure contatti la Sig.ra Cason per conferma', correct: true }
      ]
    }
  ],
  'gestione_pause': [
    {
      number: 1,
      text: 'Qual è la durata standard della pausa pranzo?',
      options: [
        { text: '45-60 minuti', correct: true },
        { text: '30 minuti', correct: false },
        { text: '2 ore', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Le pause vanno coordinate con i colleghi?',
      options: [
        { text: 'No, ognuno decide liberamente', correct: false },
        { text: 'Sì, sempre', correct: true },
        { text: 'Solo in alta stagione', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Durante la pausa pranzo, un cliente chiama per un\'emergenza. Cosa fare?',
      options: [
        { text: 'Ignorare la chiamata', correct: false },
        { text: 'Dire al cliente di richiamare dopo', correct: false },
        { text: 'Gestire l\'emergenza se si è l\'unico presente, altrimenti passare a collega disponibile', correct: true }
      ]
    }
  ],
  'gestione-casi-non-previsti': [
    {
      number: 1,
      text: 'Quando ci si trova di fronte a un caso non previsto dalle procedure, cosa fare PRIMA?',
      options: [
        { text: 'Valutare se è urgente e raccogliere informazioni', correct: true },
        { text: 'Decidere autonomamente', correct: false },
        { text: 'Rimandare il cliente', correct: false }
      ]
    },
    {
      number: 2,
      text: 'A chi va segnalato un caso non previsto?',
      options: [
        { text: 'A nessuno, basta gestirlo', correct: false },
        { text: 'Al responsabile o manager per valutazione', correct: true },
        { text: 'Solo al titolare', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente chiede un servizio mai offerto prima. Approccio corretto?',
      options: [
        { text: 'Rifiutare immediatamente', correct: false },
        { text: 'Accettare senza consultare', correct: false },
        { text: 'Raccogliere dettagli, consultare il responsabile, valutare fattibilità', correct: true }
      ]
    }
  ],
  'assumersi-resposanbilita-posto-lavoro': [
    {
      number: 1,
      text: 'Cosa significa assumersi responsabilità sul posto di lavoro?',
      options: [
        { text: 'Prendere iniziativa, rispondere delle proprie azioni e aiutare il team', correct: true },
        { text: 'Fare solo ciò che viene ordinato', correct: false },
        { text: 'Evitare decisioni difficili', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se si commette un errore?',
      options: [
        { text: 'Nasconderlo', correct: false },
        { text: 'Comunicarlo subito, proporre soluzione e imparare', correct: true },
        { text: 'Aspettare che qualcuno se ne accorga', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un collega è in difficoltà con un cliente. Tu hai già un cliente. Cosa fare?',
      options: [
        { text: 'Ignorare il collega', correct: false },
        { text: 'Lasciare il tuo cliente per aiutare', correct: false },
        { text: 'Valutare se puoi dare supporto rapido o chiamare un altro collega', correct: true }
      ]
    }
  ],
  'lenti-filtro-antiluceblu': [
    {
      number: 1,
      text: 'A cosa serve il filtro antiluce blu?',
      options: [
        { text: 'Ridurre l\'affaticamento visivo da schermi digitali', correct: true },
        { text: 'Bloccare i raggi UV', correct: false },
        { text: 'Migliorare la vista notturna', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Il filtro antiluce blu è consigliato per chi?',
      options: [
        { text: 'Solo bambini', correct: false },
        { text: 'Chi usa dispositivi digitali frequentemente', correct: true },
        { text: 'Solo persone con problemi di vista', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente lavora 8 ore al giorno davanti al PC e lamenta bruciore e occhi rossi. Non ha mai fatto un controllo della vista da voi e chiede direttamente di comprare "delle lenti per il computer". Come procedi?',
      options: [
        { text: 'Vendi subito le lenti con filtro BlueGuard senza ulteriori domande', correct: false },
        { text: 'Gli dici che non puoi aiutarlo senza prescrizione medica', correct: false },
        { text: 'Proponi gentilmente un controllo optometrico per capire se è solo affaticamento o anche secchezza oculare, e nel frattempo spieghi il funzionamento del filtro', correct: true }
      ]
    }
  ],
  'note_vocali_telegram': [
    {
      number: 1,
      text: 'Le note vocali Telegram sono appropriate per comunicazioni formali con clienti?',
      options: [
        { text: 'Solo per comunicazioni interne rapide', correct: true },
        { text: 'Sì, sempre', correct: false },
        { text: 'Mai', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Qual è la durata massima consigliata per una nota vocale di lavoro?',
      options: [
        { text: '5 minuti', correct: false },
        { text: '30-60 secondi', correct: true },
        { text: 'Nessun limite', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Stai servendo un cliente quando ricevi una notifica di nota vocale sul canale OB. Il cliente sta scegliendo tra due montature e ti chiede un parere. Come gestisci la situazione?',
      options: [
        { text: 'Interrompi il cliente per ascoltare subito la nota vocale', correct: false },
        { text: 'Ignori completamente la nota vocale perché stai lavorando', correct: false },
        { text: 'Continui ad assistere il cliente e ascolti la nota vocale appena hai un momento libero o durante la pausa', correct: true }
      ]
    }
  ],
  'pulizia_riesposizione_occhiali': [
    {
      number: 1,
      text: 'Con quale frequenza va fatta la pulizia degli occhiali in esposizione?',
      options: [
        { text: 'Giornaliera', correct: true },
        { text: 'Settimanale', correct: false },
        { text: 'Mensile', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa usare per pulire le lenti degli occhiali in esposizione?',
      options: [
        { text: 'Detergente generico per vetri', correct: false },
        { text: 'Spray specifico per lenti ottiche e panno microfibra', correct: true },
        { text: 'Acqua e carta', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Durante la sanificazione UV noti che 3 occhiali da sole hanno graffi sulle lenti. Uno è un modello Gucci da €380 molto richiesto, di cui non hai altri esemplari. Un cliente sta entrando e sembra interessato proprio a quella categoria. Come ti comporti?',
      options: [
        { text: 'Rimetti tutti gli occhiali in esposizione, tanto sono graffi piccoli', correct: false },
        { text: 'Vendi il Gucci graffiato con sconto senza informare il cliente del difetto', correct: false },
        { text: 'Rimuovi tutti e 3 dalla vendita, li segnali nel registro anomalie, e proponi al cliente altri modelli disponibili', correct: true }
      ]
    }
  ],
  'pulizia-sala-refrazione': [
    {
      number: 1,
      text: 'Quando va pulita la sala refrazione?',
      options: [
        { text: 'Ogni giorno prima e dopo gli appuntamenti', correct: true },
        { text: 'Fine settimana', correct: false },
        { text: 'Solo quando è visibilmente sporca', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Quali strumenti vanno igienizzati dopo ogni paziente?',
      options: [
        { text: 'Solo il forottero', correct: false },
        { text: 'Tutti gli strumenti a contatto con il paziente: mentoniera, forottero, frontifocometro', correct: true },
        { text: 'Nessuno, basta pulizia settimanale', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un paziente starnutisce durante la visita. Cosa fare dopo?',
      options: [
        { text: 'Continuare normalmente', correct: false },
        { text: 'Igienizzare solo a fine giornata', correct: false },
        { text: 'Igienizzare immediatamente tutte le superfici e strumenti usati', correct: true }
      ]
    }
  ],
  'prevenzione-diffusione-influenza': [
    {
      number: 1,
      text: 'Secondo la procedura, dove bisogna tossire o starnutire?',
      options: [
        { text: 'Nel gomito', correct: true },
        { text: 'Nella mano, poi ci si lava', correct: false },
        { text: 'Nel palmo coprendo la bocca', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Dopo aver gettato un fazzoletto usato, cosa va fatto subito?',
      options: [
        { text: 'Lavare o disinfettare le mani', correct: true },
        { text: 'Chiudere il cestino e tornare al lavoro', correct: false },
        { text: 'Aspettare la pausa per lavarsi', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Hai tosse leggera e devi lavorare a distanza ravvicinata con i clienti. Qual è il comportamento corretto?',
      options: [
        { text: 'Avvisi il responsabile, applichi l\'igiene scrupolosa e indossi la mascherina', correct: true },
        { text: 'Lavori normalmente senza dirlo, per non creare allarmismi', correct: false },
        { text: 'Resti a casa anche senza febbre perché è sempre obbligatorio', correct: false }
      ]
    }
  ],
  'introduttiva': [
    {
      number: 1,
      text: 'Qual è lo scopo principale del sistema di procedure di Ottica Bianchi?',
      options: [
        { text: 'Garantire qualità, coerenza e efficienza nel servizio', correct: true },
        { text: 'Controllare i dipendenti', correct: false },
        { text: 'Aumentare il carico di lavoro', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Cosa fare se una procedura non è chiara?',
      options: [
        { text: 'Ignorarla', correct: false },
        { text: 'Chiedere chiarimenti al responsabile', correct: true },
        { text: 'Interpretarla a proprio modo', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Durante una giornata intensa, un tuo collega serve un cliente in modo frettoloso: non lo saluta, non si presenta e liquida rapidamente la richiesta dicendo "non abbiamo tempo oggi". Il cliente se ne va visibilmente deluso. Tu sei impegnato con un altro cliente. Cosa fai dopo?',
      options: [
        { text: 'Non dici nulla, ognuno lavora come preferisce', correct: false },
        { text: 'Critichi il collega davanti agli altri clienti', correct: false },
        { text: 'Parli con il collega in modo costruttivo, ricordando i valori OB, oppure segnali la situazione al responsabile', correct: true }
      ]
    }
  ],
  'procedura-ricontatto-clienti-per-posizioni-amministrative-aperte': [
    {
      number: 1,
      text: 'Cosa bisogna verificare PRIMA di contattare un cliente con posizione aperta?',
      options: [
        { text: 'Che la fattura sia corretta, scaduta, senza pagamenti in corso, note di credito o accordi esistenti', correct: true },
        { text: 'Solo il nome del cliente', correct: false },
        { text: 'Solo l\'importo dovuto', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Senza quale elemento il cliente NON deve essere contattato?',
      options: [
        { text: 'Senza il numero di telefono', correct: false },
        { text: 'Senza autorizzazione esplicita del Manager o Titolare', correct: true },
        { text: 'Senza l\'email del cliente', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente ha una fattura scaduta da 3 mesi per €450. Hai verificato nel gestionale: nessun pagamento registrato, nessun bonifico in corso, nessuna nota di credito. Però trovi una nota che dice "accordo rateizzazione verbale con Valentina". Cosa fai?',
      options: [
        { text: 'Procedi a contattare il cliente perché la fattura è scaduta e l\'importo è rilevante', correct: false },
        { text: 'Contatti il cliente per ricordargli l\'accordo di rateizzazione', correct: false },
        { text: 'Non contatti il cliente e verifichi prima con Valentina i dettagli dell\'accordo', correct: true }
      ]
    }
  ],
  'organigramma-e-regole-di-condotta-operativa': [
    {
      number: 1,
      text: 'Qual è la catena di comando indicata nella procedura?',
      options: [
        { text: 'Enrico Bianchi → Valentina/Marco → Staff operativo', correct: true },
        { text: 'Marco Comparini → Enrico Bianchi → Staff operativo', correct: false },
        { text: 'Staff operativo → Direzione Operativa → Titolare', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Per attività fuori dalla normale amministrazione o con rischio economico, cosa è obbligatorio fare?',
      options: [
        { text: 'Procedere in autonomia se il cliente è presente', correct: false },
        { text: 'Chiedere autorizzazione preventiva al Responsabile di Turno (Marco o Valentina)', correct: true },
        { text: 'Informare il responsabile solo a lavoro concluso', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Hai commesso un errore evitabile durante una lavorazione. Secondo le regole interne, qual è il comportamento corretto?',
      options: [
        { text: 'Nascondere l\'errore per non creare problemi', correct: false },
        { text: 'Aspettare che se ne accorga qualcun altro', correct: false },
        { text: 'Dichiararlo subito: l\'errore dichiarato è occasione di miglioramento', correct: true }
      ]
    }
  ],
  'riadattamento-lenti-su-nuova-montatura': [
    {
      number: 1,
      text: 'Durante la valutazione compatibilità, se la lente non copre la nuova montatura, cosa si deve fare?',
      options: [
        { text: 'Procedere comunque con il montaggio', correct: false },
        { text: 'Ridurre la montatura finché la lente entra', correct: false },
        { text: 'STOP: non procedere e proporre lenti nuove con sconto rottamazione', correct: true }
      ]
    },
    {
      number: 2,
      text: 'Prima di iniziare il riadattamento, quale passaggio è obbligatorio?',
      options: [
        { text: 'Far firmare la manleva dopo il montaggio', correct: false },
        { text: 'Far firmare la manleva/informativa al cliente', correct: true },
        { text: 'Spedire le lenti in laboratorio esterno', correct: false }
      ]
    },
    {
      number: 3,
      text: 'La lente è al limite di copertura (<1mm). Come si procede secondo la procedura?',
      options: [
        { text: 'Si procede senza comunicarlo al cliente', correct: false },
        { text: 'Si consulta il Responsabile per valutare il rischio estetico/decentramento', correct: true },
        { text: 'Si rifiuta sempre il lavoro senza valutazioni', correct: false }
      ]
    }
  ],
  'assistenza-prodotti-garmin': [
    {
      number: 1,
      text: 'Secondo la procedura, Garmin ripara i dispositivi?',
      options: [
        { text: 'Sì, li ripara sempre', correct: false },
        { text: 'No, li sostituisce con unità ricondizionate pari al nuovo', correct: true },
        { text: 'Solo in garanzia li ripara', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Per una pratica in garanzia, quale documento è obbligatorio?',
      options: [
        { text: 'Scontrino o fattura originale', correct: true },
        { text: 'Estratto carta di credito', correct: false },
        { text: 'Solo numero di serie', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Fuori garanzia, Garmin invia un PDF con le opzioni. Cosa serve perché procedano?',
      options: [
        { text: 'Spedire un secondo dispositivo di prova', correct: false },
        { text: 'Contattare il cliente solo telefonicamente', correct: false },
        { text: 'Restituire a Garmin il PDF compilato con la scelta del cliente', correct: true }
      ]
    }
  ],
  'gestione-risposte-negative-al-cliente': [
    {
      number: 1,
      text: 'Qual è la sequenza corretta per una risposta negativa al cliente?',
      options: [
        { text: 'Comunicare il limite → riconoscere la richiesta → offrire alternativa', correct: false },
        { text: 'Riconoscere la richiesta → comunicare il limite → offrire alternativa', correct: true },
        { text: 'Offrire alternativa → dire no → chiudere', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Quale comportamento NON è accettabile?',
      options: [
        { text: 'Dire “no” secco senza spiegazione', correct: true },
        { text: 'Proporre un\'alternativa concreta', correct: false },
        { text: 'Usare toni rispettosi e chiari', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Un cliente chiede uno sconto extra non previsto. Qual è la risposta corretta?',
      options: [
        { text: 'Concedere lo sconto per evitare il conflitto', correct: false },
        { text: 'Rifiutare e chiudere la conversazione', correct: false },
        { text: 'Spiegare il limite e proporre un\'alternativa in offerta o simile', correct: true }
      ]
    }
  ]
};

// Alias for filename-based lookups (file key differs from procedure slug)
QUIZ_DATA['ricontatto-clienti-posizioni-amministrative-aperte'] =
  QUIZ_DATA['procedura-ricontatto-clienti-per-posizioni-amministrative-aperte'];

// Procedures that don't require quizzes (reference/general)
export const NO_QUIZ_PROCEDURES = [
  'elenco_procedure_client_side'
];

/**
 * Generate quiz markdown section
 */
function generateQuizSection(slug, questions) {
  if (!questions || questions.length === 0) {
    return '';
  }

  let quizMd = '\n---\n\n';
  quizMd += '## Quiz di Verifica Comprensione 📝\n\n';
  quizMd += '> **Importante:** Questa procedura richiede il superamento di un quiz di verifica.\n';
  quizMd += '> Dovrai rispondere correttamente a **tutte e 3 le domande** per confermare la lettura.\n';
  quizMd += '> - ✅ Hai **3 tentativi** disponibili\n';
  quizMd += '> - ⏱️ Tra un tentativo e l\'altro devi attendere **1 ora**\n';
  quizMd += '> - 📚 Dopo 3 tentativi falliti, sarà richiesto un **colloquio con il manager**\n\n';
  quizMd += '_Il quiz verrà presentato automaticamente al termine della lettura della procedura._\n\n';

  quizMd += '### Anteprima Domande\n\n';
  quizMd += '<details>\n';
  quizMd += '<summary><strong>Clicca per vedere un\'anteprima delle domande del quiz</strong></summary>\n\n';

  questions.forEach((q, idx) => {
    const difficultyEmoji = q.number === 1 ? '🟢' : q.number === 2 ? '🟡' : '🔴';
    const difficultyText = q.number === 1 ? 'Facile' : q.number === 2 ? 'Media' : 'Difficile';

    quizMd += `**Domanda ${q.number}** ${difficultyEmoji} _${difficultyText}_\n\n`;
    quizMd += `${q.text}\n\n`;

    q.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx); // A, B, C
      quizMd += `- ${letter}. ${opt.text}\n`;
    });

    if (idx < questions.length - 1) {
      quizMd += '\n---\n\n';
    }
  });

  quizMd += '\n</details>\n\n';
  quizMd += '> 💡 **Suggerimento:** Leggi attentamente tutta la procedura prima di affrontare il quiz.\n';
  quizMd += '> Le risposte si trovano nel contenuto sopra!\n\n';

  return quizMd;
}

/**
 * Process a single markdown file
 */
function processMarkdownFile(filePath) {
  const fileName = path.basename(filePath, '.md');
  const slug = fileName;

  console.log(`\nProcessing: ${fileName}`);

  // Skip if no quiz required
  if (NO_QUIZ_PROCEDURES.includes(slug)) {
    console.log(`  ⏭️  Skipped (no quiz required)`);
    return;
  }

  // Check if quiz data exists
  const quizQuestions = QUIZ_DATA[slug];
  if (!quizQuestions) {
    console.log(`  ⚠️  Warning: No quiz data found for slug "${slug}"`);
    return;
  }

  // Read file content
  let content = fs.readFileSync(filePath, 'utf-8');

  // Check if quiz already exists
  if (content.includes('## Quiz di Verifica Comprensione')) {
    console.log(`  ✓ Quiz section already exists, skipping`);
    return;
  }

  // Find the Mini-Help section
  const miniHelpIndex = content.indexOf('### **Mini-Help');

  // Generate quiz section
  const quizSection = generateQuizSection(slug, quizQuestions);

  let updatedContent;

  if (miniHelpIndex === -1) {
    // No Mini-Help section, append quiz at the end
    console.log(`  📌 Mini-Help section not found, appending quiz at end`);
    updatedContent = content.trimEnd() + '\n' + quizSection;
  } else {
    // Insert quiz section before Mini-Help
    updatedContent =
      content.substring(0, miniHelpIndex) +
      quizSection +
      content.substring(miniHelpIndex);
  }

  // Write back to file
  fs.writeFileSync(filePath, updatedContent, 'utf-8');
  console.log(`  ✅ Quiz section added (${quizQuestions.length} questions)`);
}

/**
 * Main execution
 */
function main() {
  const proceduresDir = path.join(__dirname, '..', 'procedure_personale');

  console.log('🚀 Starting quiz section insertion...');
  console.log(`📁 Procedures directory: ${proceduresDir}\n`);

  // Get all markdown files
  const files = fs.readdirSync(proceduresDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(proceduresDir, file));

  console.log(`Found ${files.length} procedure files\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Process each file
  files.forEach(file => {
    try {
      processMarkdownFile(file);
      processed++;
    } catch (error) {
      console.error(`  ❌ Error processing file: ${error.message}`);
      errors++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`  ✅ Processed: ${processed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('='.repeat(60));
  console.log('\n✨ Done!\n');
}

const argvPath = process.argv[1]
  ? (path.isAbsolute(process.argv[1])
    ? process.argv[1]
    : path.resolve(process.cwd(), process.argv[1]))
  : null;
const isDirectRun = argvPath
  && import.meta.url === pathToFileURL(argvPath).href;

// Run the script
if (isDirectRun) {
  main();
}
