// app/dashboard/_components/WorkflowLogic.ts
// Workflow Logic per Ottica Bianchi
// Definisce quali transizioni sono permesse e perché

export type WorkflowState = 
  | 'nuove'
  | 'materiali_ordinati' 
  | 'materiali_parzialmente_arrivati'
  | 'materiali_arrivati'
  | 'in_lavorazione'
  | 'pronto_ritiro'
  | 'consegnato_pagato';

// Tipi di lavorazione speciali che hanno workflow diversi
export const SPECIAL_WORK_TYPES = {
  'FT': 'fattura',           // Emissione fattura
  'REL': 'relazione',        // Relazione tecnica
  'RIP': 'riparazione'       // Riparazione esterna
} as const;

// Matrice delle transizioni permesse
export const ALLOWED_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  
  // NUOVE: Può andare ovunque (inclusi workflow speciali)
  'nuove': [
    'materiali_ordinati',      // Workflow normale
    'materiali_parzialmente_arrivati', // Cliente porta alcuni materiali
    'materiali_arrivati',      // Cliente porta tutto
    'in_lavorazione',          // Solo montaggio/aggiustamento
    'pronto_ritiro',           // Riparazione immediata
    'consegnato_pagato'        // WORKFLOW SPECIALI: Fattura, Relazione
  ],

  // MATERIALI_ORDINATI: Può avanzare, ri-ordinare o tornare indietro
  'materiali_ordinati': [
    'nuove',                   // Errore: ordine sbagliato, torna a nuove
    'materiali_parzialmente_arrivati', // Arriva qualcosa
    'materiali_arrivati',      // Arriva tutto insieme
    'materiali_ordinati',      // Ri-ordine per problemi/errori
    'pronto_ritiro'            // Riparazione esterna completata
  ],

  // MATERIALI_PARZIALMENTE_ARRIVATI: Normale workflow o problemi
  'materiali_parzialmente_arrivati': [
    'nuove',                   // Errore: annulla tutto
    'materiali_ordinati',      // Problema: ri-ordinare tutto
    'materiali_arrivati',      // Arriva il resto
    'in_lavorazione'           // Possiamo iniziare con quello che c'è
  ],

  // MATERIALI_ARRIVATI: Pronti per lavorazione o problemi
  'materiali_arrivati': [
    'nuove',                   // Errore: annulla tutto
    'materiali_ordinati',      // Materiali danneggiati/sbagliati
    'materiali_parzialmente_arrivati', // Qualcosa si rompe/perde
    'in_lavorazione',          // Workflow normale
    'pronto_ritiro'            // Lavorazione esterna già fatta
  ],

  // IN_LAVORAZIONE: Avanza o torna per problemi tecnici
  'in_lavorazione': [
    'nuove',                   // Errore: annulla tutto e ricomincia
    'materiali_ordinati',      // Problema grave: serve ri-ordinare
    'materiali_parzialmente_arrivati', // Manca qualcosa durante lavorazione
    'materiali_arrivati',      // Torna indietro: materiali pronti ma lavorazione da rifare
    'in_lavorazione',          // Cambio lavoratore/turno
    'pronto_ritiro'            // Lavorazione completata
  ],

  // PRONTO_RITIRO: Consegna o problemi dell'ultimo minuto
  'pronto_ritiro': [
    'in_lavorazione',          // Problema trovato: torna in lavorazione
    'consegnato_pagato'        // Cliente ritira
  ],

  // CONSEGNATO_PAGATO: Stato finale (mai modificabile)
  'consegnato_pagato': []
};

// Messaggi di spiegazione per ogni transizione
export const TRANSITION_REASONS: Record<string, string> = {
  'nuove->materiali_ordinati': 'Ordina materiali necessari',
  'nuove->materiali_arrivati': 'Cliente porta i materiali',
  'nuove->in_lavorazione': 'Solo montaggio/aggiustamento',
  'nuove->pronto_ritiro': 'Riparazione immediata',
  'nuove->consegnato_pagato': 'Workflow speciale: Fattura/Relazione/Servizio immediato',

  'materiali_ordinati->nuove': 'Errore: ordine sbagliato, ricomincia da capo',
  'materiali_ordinati->materiali_parzialmente_arrivati': 'Arrivata parte dell\'ordine',
  'materiali_ordinati->materiali_arrivati': 'Ordine completo arrivato',
  'materiali_ordinati->materiali_ordinati': 'Ri-ordine per errore/problema',
  'materiali_ordinati->pronto_ritiro': 'Riparazione esterna completata',

  'materiali_parzialmente_arrivati->nuove': 'Errore: annulla tutto e ricomincia',
  'materiali_parzialmente_arrivati->materiali_ordinati': 'Problema: ri-ordinare tutto',
  'materiali_parzialmente_arrivati->materiali_arrivati': 'Arrivato il resto',
  'materiali_parzialmente_arrivati->in_lavorazione': 'Iniziare con materiali disponibili',

  'materiali_arrivati->nuove': 'Errore: annulla tutto e ricomincia',
  'materiali_arrivati->materiali_ordinati': 'Materiali danneggiati/sbagliati',
  'materiali_arrivati->materiali_parzialmente_arrivati': 'Problema: manca qualcosa',
  'materiali_arrivati->in_lavorazione': 'Inizia lavorazione',
  'materiali_arrivati->pronto_ritiro': 'Lavorazione esterna già completata',

  'in_lavorazione->nuove': 'Errore critico: annulla tutto e ricomincia',
  'in_lavorazione->materiali_ordinati': 'Errore grave: serve ri-ordinare',
  'in_lavorazione->materiali_parzialmente_arrivati': 'Scoperto che manca qualcosa',
  'in_lavorazione->materiali_arrivati': 'Problema lavorazione: ricomincia',
  'in_lavorazione->pronto_ritiro': 'Lavorazione completata',

  'pronto_ritiro->in_lavorazione': 'Problema trovato: torna in lavorazione',
  'pronto_ritiro->consegnato_pagato': 'Cliente ha ritirato e pagato'
};

// Funzione per verificare se una busta ha workflow speciale
export function hasSpecialWorkflow(tipoLavorazione: string | null): boolean {
  if (!tipoLavorazione) return false;
  return Object.keys(SPECIAL_WORK_TYPES).includes(tipoLavorazione);
}

// Funzione per verificare se una transizione è permessa
export function isTransitionAllowed(from: WorkflowState, to: WorkflowState, tipoLavorazione?: string | null | undefined): boolean {
  console.log('🔍 CHECKING TRANSITION:', { from, to, tipoLavorazione });
  
  // Se è la stessa colonna, sempre permesso
  if (from === to) {
    console.log('🔍 SAME COLUMN - ALLOWED');
    return true;
  }
  
  const normalizedTipo = tipoLavorazione ?? null;
  const baseAllowed = ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  
  console.log('🔍 BASE ALLOWED:', baseAllowed);
  
  // Per workflow speciali da "nuove" a "consegnato_pagato"
  if (from === 'nuove' && to === 'consegnato_pagato' && hasSpecialWorkflow(normalizedTipo)) {
    console.log('🔍 SPECIAL WORKFLOW - ALLOWED');
    return true;
  }
  
  console.log('🔍 FINAL RESULT:', baseAllowed);
  return baseAllowed;
}

// Funzione per ottenere tutti gli stati possibili da uno stato corrente
export function getAllowedNextStates(currentState: WorkflowState, tipoLavorazione?: string | null | undefined): WorkflowState[] {
  const baseStates = ALLOWED_TRANSITIONS[currentState] || [];
  
  // Normalizza il parametro per gestire undefined
  const normalizedTipo = tipoLavorazione ?? null;
  
  // Se è workflow speciale e siamo in "nuove", evidenzia il salto diretto
  if (currentState === 'nuove' && hasSpecialWorkflow(normalizedTipo)) {
    return [...baseStates]; // Include già consegnato_pagato
  }
  
  return baseStates;
}

// Funzione per ottenere la spiegazione di una transizione
export function getTransitionReason(from: WorkflowState, to: WorkflowState, tipoLavorazione?: string | null | undefined): string {
  const key = `${from}->${to}`;
  let reason = TRANSITION_REASONS[key] || 'Transizione non definita';
  
  // Normalizza il parametro per gestire undefined
  const normalizedTipo = tipoLavorazione ?? null;
  
  // Personalizza per workflow speciali
  if (from === 'nuove' && to === 'consegnato_pagato' && normalizedTipo) {
    const specialType = SPECIAL_WORK_TYPES[normalizedTipo as keyof typeof SPECIAL_WORK_TYPES];
    if (specialType) {
      reason = `Workflow ${specialType}: completato immediatamente`;
    }
  }
  
  return reason;
}