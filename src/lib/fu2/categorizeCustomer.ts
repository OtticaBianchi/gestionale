/**
 * FU2.0 - Customer Categorization Logic
 *
 * Automatically categorizes customers based on follow-up satisfaction,
 * spending patterns, and feedback notes.
 */

export type LivelloSoddisfazione =
  | 'molto_soddisfatto'
  | 'soddisfatto'
  | 'poco_soddisfatto'
  | 'insoddisfatto';

export type CallStatus =
  | 'da_chiamare'
  | 'chiamato_completato'
  | 'non_vuole_essere_contattato'
  | 'non_risponde'
  | 'numero_sbagliato'
  | 'richiamami';

export type CategoriaCliente =
  | 'super_fan'
  | 'fan'
  | 'a_rischio'
  | 'critico'
  | 'perso'
  | 'delicato_su_comunicazione'
  | 'sensibile_al_prezzo'
  | null;

export interface CustomerCategorizationInput {
  soddisfazione?: LivelloSoddisfazione | null; // Optional now - some call statuses don't have satisfaction
  stato_chiamata: CallStatus;
  ticket_value?: number | null; // Total order value from busta
  note_chiamata?: string | null;
  problema_risolto?: boolean;
}

export interface CustomerCategorizationConfig {
  soglia_alta: number; // High-value customer threshold (e.g., €450)
}

// Default configuration (can be overridden)
const DEFAULT_CONFIG: CustomerCategorizationConfig = {
  soglia_alta: 450,
};

/**
 * Categorize customer based on follow-up data
 *
 * Business Rules (Extended from PRD Section 3.4):
 *
 * PRIORITY 0 (HIGHEST): Call Status-based categorization
 * - IF stato_chiamata = "non_vuole_essere_contattato" → "perso" (client explicitly refuses contact)
 *
 * PRIORITY 1: Note pattern matching
 * - IF note MATCH "*INFORMAZIONE|CAPITO|TEMPI*" → "delicato_su_comunicazione"
 * - IF note MATCH "*CARO|PREZZO|COSTOSO*" → "sensibile_al_prezzo"
 *
 * PRIORITY 2: Satisfaction-based (only for "chiamato_completato")
 * - IF soddisfazione IN ("poco_soddisfatto","insoddisfatto") AND problema_risolto = false → "critico"
 * - IF soddisfazione IN ("poco_soddisfatto","insoddisfatto") AND problema_risolto = true → "a_rischio"
 * - IF soddisfazione = "molto_soddisfatto" AND ticket >= SOGLIA_ALTA → "super_fan"
 * - IF soddisfazione = "molto_soddisfatto" AND ticket < SOGLIA_ALTA → "fan"
 *
 * @param input Customer categorization data
 * @param config Optional configuration (uses defaults if not provided)
 * @returns CategoriaCliente value
 */
export function categorizeCustomer(
  input: CustomerCategorizationInput,
  config: CustomerCategorizationConfig = DEFAULT_CONFIG
): CategoriaCliente {
  const { soddisfazione, stato_chiamata, ticket_value, note_chiamata, problema_risolto } = input;

  // PRIORITY 0: Lost customers (explicit refusal)
  if (stato_chiamata === 'non_vuole_essere_contattato') {
    return 'perso';
  }

  // Priority 1: Check for communication sensitivity patterns in notes
  if (note_chiamata) {
    const noteUpper = note_chiamata.toUpperCase();

    // Rule 4: Communication-sensitive customers
    const communicationKeywords = [
      'INFORMAZIONE',
      'INFORMAZIONI',
      'CAPITO',
      'CAPIRE',
      'TEMPI',
      'TEMPO',
      'COMUNICAZIONE',
      'AVVISARE',
      'AVVISATO',
      'INFORMATO',
      'SPIEGARE',
      'SPIEGATO',
    ];

    if (communicationKeywords.some((keyword) => noteUpper.includes(keyword))) {
      return 'delicato_su_comunicazione';
    }

    // Rule 5: Price-sensitive customers
    const priceKeywords = [
      'CARO',
      'CARA',
      'PREZZO',
      'PREZZI',
      'COSTOSO',
      'COSTOSA',
      'COSTI',
      'COSTO',
      'ECONOMICO',
      'ECONOMICA',
      'SCONTO',
      'SCONTI',
      'RISPARMIO',
    ];

    if (priceKeywords.some((keyword) => noteUpper.includes(keyword))) {
      return 'sensibile_al_prezzo';
    }
  }

  // Priority 2: Check for dissatisfaction (at-risk or critical customers)
  // Only applies if we have satisfaction data (i.e., call was completed)
  if (soddisfazione) {
    const isDissatisfied =
      soddisfazione === 'poco_soddisfatto' || soddisfazione === 'insoddisfatto';

    if (isDissatisfied) {
      if (problema_risolto === true) {
        // Rule 3: Customer was dissatisfied but problem was resolved
        return 'a_rischio';
      } else {
        // Rule 3b: Customer is dissatisfied and problem is NOT resolved
        // This is CRITICAL - high risk of losing the client, needs immediate action
        return 'critico';
      }
    }
  }

  // Priority 3: Satisfaction-based categorization
  if (soddisfazione === 'molto_soddisfatto') {
    const ticketAmount = ticket_value ?? 0;

    if (ticketAmount >= config.soglia_alta) {
      // Rule 1: High-value satisfied customer
      return 'super_fan';
    } else {
      // Rule 2: Standard satisfied customer
      return 'fan';
    }
  }

  // Default: No specific category
  return null;
}

/**
 * Get human-readable label for categoria_cliente
 */
export function getCategoriaClienteLabel(categoria: CategoriaCliente): string {
  if (!categoria) return 'Non categorizzato';

  const labels: Record<NonNullable<CategoriaCliente>, string> = {
    super_fan: 'Super Fan',
    fan: 'Fan',
    a_rischio: 'A Rischio',
    critico: 'Critico',
    perso: 'Perso',
    delicato_su_comunicazione: 'Delicato su Comunicazione',
    sensibile_al_prezzo: 'Sensibile al Prezzo',
  };

  return labels[categoria] || categoria;
}

/**
 * Get color class for UI display of categoria_cliente
 */
export function getCategoriaClienteColor(categoria: CategoriaCliente): string {
  if (!categoria) return 'bg-gray-100 text-gray-600 ring-gray-200';

  const colors: Record<NonNullable<CategoriaCliente>, string> = {
    super_fan: 'bg-purple-100 text-purple-800 ring-purple-200',
    fan: 'bg-blue-100 text-blue-800 ring-blue-200',
    a_rischio: 'bg-amber-100 text-amber-800 ring-amber-200',
    critico: 'bg-red-100 text-red-800 ring-red-200',
    perso: 'bg-gray-900 text-white ring-gray-700',
    delicato_su_comunicazione: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
    sensibile_al_prezzo: 'bg-rose-100 text-rose-800 ring-rose-200',
  };

  return colors[categoria] || 'bg-gray-100 text-gray-600 ring-gray-200';
}

/**
 * Get icon for categoria_cliente (emoji or icon name)
 */
export function getCategoriaClienteIcon(categoria: CategoriaCliente): string {
  if (!categoria) return '❓';

  const icons: Record<NonNullable<CategoriaCliente>, string> = {
    super_fan: '⭐',
    fan: '😊',
    a_rischio: '⚠️',
    critico: '🚨',
    perso: '💔',
    delicato_su_comunicazione: '📢',
    sensibile_al_prezzo: '💰',
  };

  return icons[categoria] || '❓';
}

/**
 * Get description for categoria_cliente
 */
export function getCategoriaClienteDescription(categoria: CategoriaCliente): string {
  if (!categoria) return 'Cliente non ancora categorizzato';

  const descriptions: Record<NonNullable<CategoriaCliente>, string> = {
    super_fan:
      'Cliente molto soddisfatto con alto valore d\'acquisto. Potenziale ambassador del brand.',
    fan: 'Cliente soddisfatto. Buona esperienza complessiva.',
    a_rischio:
      'Cliente insoddisfatto ma con problema risolto. Richiede attenzione per evitare perdita.',
    critico:
      'Cliente insoddisfatto con problema NON risolto. URGENTE: alto rischio di perdita cliente, richiede azione immediata.',
    perso:
      'Cliente perso. Ha esplicitamente rifiutato ulteriori contatti. Non tentare follow-up futuri.',
    delicato_su_comunicazione:
      'Cliente sensibile alla comunicazione. Richiede aggiornamenti frequenti e chiari.',
    sensibile_al_prezzo:
      'Cliente attento ai costi. Apprezza trasparenza e value for money.',
  };

  return descriptions[categoria] || '';
}

/**
 * Calculate impatto_cliente based on ticket value
 * Used for auto-populating error creation from follow-up
 *
 * @param ticketValue Order total value
 * @param thresholds Optional custom thresholds
 * @returns ImpattoCliente value ('basso', 'medio', 'alto')
 */
export function calculateImpattoCliente(
  ticketValue: number | null | undefined,
  thresholds = { medio: 200, alto: 400 }
): 'basso' | 'medio' | 'alto' {
  if (!ticketValue || ticketValue < thresholds.medio) {
    return 'basso';
  }

  if (ticketValue >= thresholds.alto) {
    return 'alto';
  }

  return 'medio';
}

/**
 * Validate customer categorization input
 */
export function validateCategorizationInput(
  input: Partial<CustomerCategorizationInput>
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const validSoddisfazione: LivelloSoddisfazione[] = [
    'molto_soddisfatto',
    'soddisfatto',
    'poco_soddisfatto',
    'insoddisfatto',
  ];

  if (!input.soddisfazione) {
    errors.push('livello_soddisfazione è obbligatorio');
  } else if (!validSoddisfazione.includes(input.soddisfazione)) {
    errors.push(`livello_soddisfazione non valido: ${input.soddisfazione}`);
  }

  if (input.ticket_value !== undefined && input.ticket_value !== null) {
    if (typeof input.ticket_value !== 'number' || input.ticket_value < 0) {
      errors.push('ticket_value deve essere un numero >= 0');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
