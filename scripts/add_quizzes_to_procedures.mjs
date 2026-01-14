#!/usr/bin/env node

/**
 * Add Quiz Sections to Procedure Markdown Files
 *
 * This script adds quiz sections in accordion format to all procedure markdown files
 * based on the quiz data generated from the database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Quiz data mapping - matches the SQL seed file
const QUIZ_DATA = {
  'rispondere-al-telefono': [
    {
      number: 1,
      text: 'Entro quanti squilli bisogna rispondere al telefono secondo la procedura?',
      options: [
        { text: '5 squilli', correct: false },
        { text: '3 squilli', correct: true },
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
      text: 'Cosa fare se la verifica di una richiesta richiede più di 30 secondi?',
      options: [
        { text: 'Mettere il cliente in attesa senza avvisare', correct: false },
        { text: 'Proporre una richiamata dopo aver verificato', correct: true },
        { text: 'Passare immediatamente la chiamata al manager', correct: false }
      ]
    }
  ],
  'conferma-appuntamento': [
    {
      number: 1,
      text: 'Quando va inviato il messaggio di conferma dell\'appuntamento?',
      options: [
        { text: 'Una settimana prima', correct: false },
        { text: '24 ore prima dell\'appuntamento', correct: true },
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
      text: 'Quale approccio è corretto per clienti anziani o non pratici di WhatsApp?',
      options: [
        { text: 'Insistere comunque con WhatsApp', correct: false },
        { text: 'Preferire una chiamata diretta', correct: true },
        { text: 'Inviare un SMS formale', correct: false }
      ]
    }
  ],
  'annullamento-riprogrammazione-appuntamento': [
    {
      number: 1,
      text: 'Quando un cliente chiede di spostare un appuntamento, cosa bisogna fare PRIMA?',
      options: [
        { text: 'Proporre subito un nuovo orario', correct: false },
        { text: 'Verificare la disponibilità in agenda', correct: true },
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
        { text: 'Segnalare al manager per valutazione', correct: true },
        { text: 'Accettare normalmente senza segnalazioni', correct: false }
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
        { text: 'Valutare l\'urgenza e consultare l\'optometrista per eventuale slot extra', correct: true },
        { text: 'Inserirlo in uno slot già occupato', correct: false }
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
      text: 'Qual è l\'importo minimo per richiedere un acconto?',
      options: [
        { text: '30% del totale', correct: true },
        { text: '50% del totale', correct: false },
        { text: '10% del totale', correct: false }
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
      text: 'Un cliente chiede di annullare un ordine con acconto. Cosa fare?',
      options: [
        { text: 'Rimborsare immediatamente l\'acconto', correct: false },
        { text: 'Verificare le condizioni di annullamento e consultare il titolare', correct: true },
        { text: 'Rifiutare sempre l\'annullamento', correct: false }
      ]
    }
  ],
  'consegna_lenti_progressive': [
    {
      number: 1,
      text: 'Qual è il tempo minimo da dedicare alla consegna di lenti progressive?',
      options: [
        { text: '5 minuti', correct: false },
        { text: '15-20 minuti', correct: true },
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
        { text: 'Spiegare che è normale nelle zone periferiche e serve abitudine', correct: true },
        { text: 'Inviarlo da un altro ottico', correct: false }
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
        { text: 'Fissare controllo con optometrista per verifica centratura e parametri', correct: true },
        { text: 'Offrire subito lenti diverse', correct: false }
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
      text: 'Il cliente arriva 10 minuti in ritardo. Cosa fare?',
      options: [
        { text: 'Rifiutare la visita', correct: false },
        { text: 'Valutare se c\'è tempo sufficiente o proporre riprogrammazione', correct: true },
        { text: 'Accettarlo sempre senza valutazioni', correct: false }
      ]
    }
  ],
  'busta_lavoro': [
    {
      number: 1,
      text: 'Qual è il primo passo quando si crea una nuova busta lavoro?',
      options: [
        { text: 'Stampare l\'etichetta', correct: false },
        { text: 'Verificare i dati nel gestionale e creare la busta', correct: true },
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
        { text: 'Identificarla immediatamente, marcarla come urgente e avvisare il laboratorio', correct: true },
        { text: 'Aspettare che il cliente chiami', correct: false }
      ]
    }
  ],
  'carico_occhiali_luxottica_stars': [
    {
      number: 1,
      text: 'Dove va registrato il carico degli occhiali Luxottica Stars?',
      options: [
        { text: 'Solo su carta', correct: false },
        { text: 'Nel gestionale con codici e quantità', correct: true },
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
        { text: 'Fotografare, annotare sul DDT, accettare con riserva e aprire contestazione', correct: true },
        { text: 'Accettarlo e ripararlo internamente', correct: false }
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
      text: 'Un cliente chiede un astuccio extra per occhiali Luxottica. Come comportarsi?',
      options: [
        { text: 'Regalarlo sempre', correct: false },
        { text: 'Verificare disponibilità e politica aziendale prima di fornirlo', correct: true },
        { text: 'Rifiutare sempre', correct: false }
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
      text: 'Un buono dipendente copre solo lenti, ma il cliente vuole montatura. Procedura?',
      options: [
        { text: 'Rifiutare la vendita', correct: false },
        { text: 'Applicare buono sulle lenti, fatturare separatamente la montatura', correct: true },
        { text: 'Applicare buono su tutto', correct: false }
      ]
    }
  ],
  'gestione_pause': [
    {
      number: 1,
      text: 'Qual è la durata standard della pausa pranzo?',
      options: [
        { text: '30 minuti', correct: false },
        { text: '45-60 minuti', correct: true },
        { text: '2 ore', correct: false }
      ]
    },
    {
      number: 2,
      text: 'Le pause vanno coordinate con i colleghi?',
      options: [
        { text: 'Sì, sempre', correct: true },
        { text: 'No, ognuno decide liberamente', correct: false },
        { text: 'Solo in alta stagione', correct: false }
      ]
    },
    {
      number: 3,
      text: 'Durante la pausa pranzo, un cliente chiama per un\'emergenza. Cosa fare?',
      options: [
        { text: 'Ignorare la chiamata', correct: false },
        { text: 'Gestire l\'emergenza se si è l\'unico presente, altrimenti passare a collega disponibile', correct: true },
        { text: 'Dire al cliente di richiamare dopo', correct: false }
      ]
    }
  ],
  'gestione-casi-non-previsti': [
    {
      number: 1,
      text: 'Quando ci si trova di fronte a un caso non previsto dalle procedure, cosa fare PRIMA?',
      options: [
        { text: 'Decidere autonomamente', correct: false },
        { text: 'Valutare se è urgente e raccogliere informazioni', correct: true },
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
        { text: 'Fare solo ciò che viene ordinato', correct: false },
        { text: 'Prendere iniziativa, rispondere delle proprie azioni e aiutare il team', correct: true },
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
        { text: 'Valutare se puoi dare supporto rapido o chiamare un altro collega', correct: true },
        { text: 'Lasciare il tuo cliente per aiutare', correct: false }
      ]
    }
  ],
  'lenti-filtro-antiluceblu': [
    {
      number: 1,
      text: 'A cosa serve il filtro antiluce blu?',
      options: [
        { text: 'Bloccare i raggi UV', correct: false },
        { text: 'Ridurre l\'affaticamento visivo da schermi digitali', correct: true },
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
      text: 'Un cliente chiede se il filtro antiluce blu sostituisce gli occhiali da sole. Risposta corretta?',
      options: [
        { text: 'Sì, sono equivalenti', correct: false },
        { text: 'No, filtrano lunghezze d\'onda diverse: antiluce blu per schermi, da sole per UV', correct: true },
        { text: 'Sì, ma solo d\'inverno', correct: false }
      ]
    }
  ],
  'note_vocali_telegram': [
    {
      number: 1,
      text: 'Le note vocali Telegram sono appropriate per comunicazioni formali con clienti?',
      options: [
        { text: 'Sì, sempre', correct: false },
        { text: 'Solo per comunicazioni interne rapide', correct: true },
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
      text: 'Un collega invia nota vocale con info importante durante orario negozio. Cosa fare?',
      options: [
        { text: 'Ignorarla fino a fine turno', correct: false },
        { text: 'Ascoltarla appena possibile in pausa o momento libero', correct: true },
        { text: 'Ascoltarla subito davanti ai clienti', correct: false }
      ]
    }
  ],
  'pulizia_riesposizione_occhiali': [
    {
      number: 1,
      text: 'Con quale frequenza va fatta la pulizia degli occhiali in esposizione?',
      options: [
        { text: 'Settimanale', correct: false },
        { text: 'Giornaliera', correct: true },
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
      text: 'Durante la pulizia si nota un graffio su una lente da sole in esposizione. Procedura?',
      options: [
        { text: 'Rimetterlo in esposizione', correct: false },
        { text: 'Rimuoverlo, segnalarlo e sostituirlo se possibile', correct: true },
        { text: 'Venderlo con sconto', correct: false }
      ]
    }
  ],
  'pulizia-sala-refrazione': [
    {
      number: 1,
      text: 'Quando va pulita la sala refrazione?',
      options: [
        { text: 'Fine settimana', correct: false },
        { text: 'Ogni giorno prima e dopo gli appuntamenti', correct: true },
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
        { text: 'Igienizzare immediatamente tutte le superfici e strumenti usati', correct: true },
        { text: 'Igienizzare solo a fine giornata', correct: false }
      ]
    }
  ],
  'introduttiva': [
    {
      number: 1,
      text: 'Qual è lo scopo principale del sistema di procedure di Ottica Bianchi?',
      options: [
        { text: 'Controllare i dipendenti', correct: false },
        { text: 'Garantire qualità, coerenza e efficienza nel servizio', correct: true },
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
      text: 'Le procedure sono modificabili?',
      options: [
        { text: 'No, mai', correct: false },
        { text: 'Sì, possono essere aggiornate in base a feedback e miglioramenti', correct: true },
        { text: 'Solo dal titolare', correct: false }
      ]
    }
  ]
};

// Procedures that don't require quizzes (reference/general)
const NO_QUIZ_PROCEDURES = [
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

// Run the script
main();
