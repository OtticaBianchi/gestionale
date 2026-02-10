/**
 * ET2.0 - Automatic Fault Assignment Logic
 *
 * Calculates the 'assegnazione_colpa' field based on PRD business rules.
 * This function implements the decision tree for fault attribution.
 */

export type StepWorkflow =
  | 'accoglienza'
  | 'pre_controllo'
  | 'sala_controllo'
  | 'preventivo_vendita'
  | 'ordine_materiali'
  | 'lavorazione'
  | 'controllo_qualita'
  | 'consegna'
  | 'post_vendita'
  | 'follow_up';

export type IntercettatoDa =
  | 'cliente'
  | 'ob_controllo_qualita'
  | 'ob_processo'
  | 'ob_follow_up';

export type ProceduraFlag =
  | 'procedura_presente'
  | 'procedura_imprecisa'
  | 'procedura_assente';

export type ImpattoCliente = 'basso' | 'medio' | 'alto';

export type CausaErrore =
  | 'cliente'
  | 'interno'
  | 'esterno'
  | 'non_identificabile';

export type AssegnazioneColpa =
  | 'persona'
  | 'cliente'
  | 'procedura'
  | 'organizzazione'
  | 'sistemico'
  | 'non_identificabile';

export interface ErrorClassificationInput {
  step_workflow: StepWorkflow;
  intercettato_da?: IntercettatoDa | null;
  procedura_flag: ProceduraFlag;
  impatto_cliente?: ImpattoCliente | null;
  causa_errore?: CausaErrore | null;
  operatore_coinvolto?: string | null;
  creato_da_followup?: boolean;
}

/**
 * Calculate automatic fault assignment based on PRD rules
 *
 * Business Rules (from PRD Section 3.1):
 *
 * 1. IF procedura_flag = "procedura_presente"
 *    AND operatore_coinvolto IS NOT NULL
 *      → assegnazione_colpa = "persona"
 *
 * 2. IF procedura_flag = "procedura_imprecisa"
 *      → assegnazione_colpa = "procedura"
 *
 * 3. IF procedura_flag = "procedura_assente"
 *      → assegnazione_colpa = "organizzazione"
 *
 * 4. IF creato_da_followup = true
 *    AND operatore_coinvolto IS NULL
 *      → assegnazione_colpa = "non_identificabile"
 *
 * 5. IF procedura_flag = "procedura_presente"
 *    AND causa_errore = "cliente"
 *      → assegnazione_colpa = "cliente"
 *
 * 6. IF causa_errore = "esterno"
 *      → assegnazione_colpa = "non_identificabile"
 *
 * 7. IF step_workflow IN ("ordine_materiali", "lavorazione")
 *    AND operatore_coinvolto IS NULL
 *    AND procedura_flag = "procedura_presente"
 *      → assegnazione_colpa = "sistemico"
 *
 * @param input Error classification data
 * @returns AssegnazioneColpa value
 */
export function calculateAssegnazioneColpa(
  input: ErrorClassificationInput
): AssegnazioneColpa {
  const {
    step_workflow,
    procedura_flag,
    causa_errore,
    operatore_coinvolto,
    creato_da_followup = false,
  } = input;

  // Rule 2: Imprecise procedure → procedura
  if (procedura_flag === 'procedura_imprecisa') {
    return 'procedura';
  }

  // Rule 3: Absent procedure → organizzazione
  if (procedura_flag === 'procedura_assente') {
    return 'organizzazione';
  }

  // Rule 4: Created from follow-up without operator → non_identificabile
  if (creato_da_followup && !operatore_coinvolto) {
    return 'non_identificabile';
  }

  // Rule 5: Explicit customer-caused issue → cliente
  if (
    procedura_flag === 'procedura_presente' &&
    causa_errore === 'cliente'
  ) {
    return 'cliente';
  }

  // Rule 6: External cause (supplier/third-party) -> keep out of internal blame buckets
  if (causa_errore === 'esterno') {
    return 'non_identificabile';
  }

  // Rule 7: System-related steps without operator → sistemico
  const systemicSteps: StepWorkflow[] = ['ordine_materiali', 'lavorazione'];
  if (
    systemicSteps.includes(step_workflow) &&
    !operatore_coinvolto &&
    procedura_flag === 'procedura_presente'
  ) {
    return 'sistemico';
  }

  // Rule 1: Procedure present with operator → persona
  if (procedura_flag === 'procedura_presente' && operatore_coinvolto) {
    return 'persona';
  }

  // Default fallback: if no rules match
  return 'non_identificabile';
}

/**
 * Validate ET2.0 error classification fields
 *
 * @param data Error data to validate
 * @returns Validation result with errors array
 */
export function validateErrorClassification(data: Partial<ErrorClassificationInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!data.step_workflow) {
    errors.push('step_workflow è obbligatorio');
  }

  if (!data.procedura_flag) {
    errors.push('procedura_flag è obbligatorio');
  }

  if (!data.causa_errore) {
    errors.push('causa_errore è obbligatorio');
  }

  // Validate enum values
  const validStepWorkflow: StepWorkflow[] = [
    'accoglienza',
    'pre_controllo',
    'sala_controllo',
    'preventivo_vendita',
    'ordine_materiali',
    'lavorazione',
    'controllo_qualita',
    'consegna',
    'post_vendita',
    'follow_up',
  ];

  if (data.step_workflow && !validStepWorkflow.includes(data.step_workflow)) {
    errors.push(`step_workflow non valido: ${data.step_workflow}`);
  }

  const validIntercettatoDa: IntercettatoDa[] = [
    'cliente',
    'ob_controllo_qualita',
    'ob_processo',
    'ob_follow_up',
  ];

  if (data.intercettato_da && !validIntercettatoDa.includes(data.intercettato_da)) {
    errors.push(`intercettato_da non valido: ${data.intercettato_da}`);
  }

  const validProceduraFlag: ProceduraFlag[] = [
    'procedura_presente',
    'procedura_imprecisa',
    'procedura_assente',
  ];

  if (data.procedura_flag && !validProceduraFlag.includes(data.procedura_flag)) {
    errors.push(`procedura_flag non valido: ${data.procedura_flag}`);
  }

  const validImpattoCliente: ImpattoCliente[] = ['basso', 'medio', 'alto'];

  if (data.impatto_cliente && !validImpattoCliente.includes(data.impatto_cliente)) {
    errors.push(`impatto_cliente non valido: ${data.impatto_cliente}`);
  }

  const validCause: CausaErrore[] = [
    'cliente',
    'interno',
    'esterno',
    'non_identificabile',
  ];

  if (data.causa_errore && !validCause.includes(data.causa_errore)) {
    errors.push(`causa_errore non valida: ${data.causa_errore}`);
  }

  if (
    data.causa_errore &&
    data.causa_errore !== 'interno' &&
    data.operatore_coinvolto
  ) {
    errors.push('operatore_coinvolto è consentito solo quando causa_errore è "interno"');
  }

  // Business logic validation
  if (data.procedura_flag === 'procedura_presente' && !data.operatore_coinvolto) {
    // This is allowed, but might result in 'sistemico' or 'non_identificabile'
    // No error, just a warning case
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get human-readable label for assegnazione_colpa
 */
export function getAssegnazioneColpaLabel(colpa: AssegnazioneColpa): string {
  const labels: Record<AssegnazioneColpa, string> = {
    persona: 'Errore umano (operatore)',
    cliente: 'Errore del cliente',
    procedura: 'Procedura imprecisa/inadeguata',
    organizzazione: 'Mancanza organizzativa',
    sistemico: 'Errore di sistema/processo',
    non_identificabile: 'Non identificabile',
  };

  return labels[colpa] || colpa;
}

/**
 * Get color class for UI display of assegnazione_colpa
 */
export function getAssegnazioneColpaColor(colpa: AssegnazioneColpa): string {
  const colors: Record<AssegnazioneColpa, string> = {
    persona: 'bg-orange-100 text-orange-800 ring-orange-200',
    cliente: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    procedura: 'bg-purple-100 text-purple-800 ring-purple-200',
    organizzazione: 'bg-red-100 text-red-800 ring-red-200',
    sistemico: 'bg-blue-100 text-blue-800 ring-blue-200',
    non_identificabile: 'bg-gray-100 text-gray-800 ring-gray-200',
  };

  return colors[colpa] || colors.non_identificabile;
}
