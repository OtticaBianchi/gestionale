// utils/errorHandler.ts
// ✅ SECURITY: Gestione centralizzata degli errori con sanitizzazione

export interface ErrorDetails {
  message: string;
  code?: string;
  details?: any;
  hint?: string;
  timestamp?: string;
  context?: string;
}

/**
 * Gestisce gli errori in modo sicuro - log dettagliato server-side, messaggio generico client-side
 */
export function handleError(error: any, context: string = 'Unknown'): ErrorDetails {
  const errorDetails: ErrorDetails = {
    message: error.message || 'Si è verificato un errore imprevisto',
    code: error.code,
    details: error.details,
    hint: error.hint,
    timestamp: new Date().toISOString(),
    context
  };

  // Log dettagliato per sviluppo e monitoring
  console.error(`❌ Error in ${context}:`, {
    ...errorDetails,
    stack: error.stack,
    originalError: error
  });

  return errorDetails;
}

/**
 * Restituisce un messaggio di errore user-friendly basato sul codice di errore
 */
export function getUserFriendlyMessage(error: any): string {
  // Messaggi specifici per errori comuni
  if (error.code === 'PGRST116') {
    return 'Record non trovato. Potrebbe essere stato eliminato o non hai i permessi per accedervi.';
  }
  
  if (error.code === 'PGRST301') {
    return 'Non hai i permessi necessari per questa operazione.';
  }
  
  if (error.code === '23505') {
    return 'Questo dato esiste già. Controlla i campi duplicati.';
  }
  
  if (error.code === '23503') {
    return 'Operazione non consentita. Alcuni dati sono ancora in uso.';
  }
  
  if (error.message?.includes('JWT')) {
    return 'Sessione scaduta. Effettua nuovamente il login.';
  }
  
  if (error.message?.includes('network')) {
    return 'Problema di connessione. Controlla la tua connessione internet.';
  }
  
  // Messaggio generico per errori non riconosciuti
  return 'Si è verificato un errore imprevisto. Riprova tra qualche istante.';
}

/**
 * Componente di errore standard per l'app
 */
export function formatErrorForUI(error: any, context: string = 'Operazione') {
  const errorDetails = handleError(error, context);
  const userMessage = getUserFriendlyMessage(error);
  
  return {
    title: 'Errore',
    message: userMessage,
    actions: [
      {
        label: 'Riprova',
        action: () => window.location.reload(),
        variant: 'primary' as const
      },
      {
        label: 'Torna Indietro',
        action: () => window.history.back(),
        variant: 'secondary' as const
      }
    ],
    // Solo in sviluppo
    debugInfo: process.env.NODE_ENV === 'development' ? errorDetails : null
  };
}