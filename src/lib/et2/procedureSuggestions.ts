/**
 * ET2.0 - Automatic Procedure Suggestions Generation
 *
 * Auto-generates procedure suggestions based on error classification
 * when procedures are identified as imprecise or absent.
 */

import { ProceduraFlag, StepWorkflow } from './assegnazioneColpa';

export type TipoSuggerimento = 'manual' | 'refine' | 'new_procedure';

export interface ProcedureSuggestionInput {
  errore_id: string;
  procedure_id?: string; // Existing procedure if refining
  step_workflow: StepWorkflow;
  procedura_flag: ProceduraFlag;
  error_description: string;
  error_type?: string;
}

export interface ProcedureSuggestionOutput {
  should_create: boolean;
  suggestion_data?: {
    procedure_id?: string;
    errore_id: string;
    step_workflow: StepWorkflow;
    tipo_suggerimento: TipoSuggerimento;
    title: string;
    description: string;
    status: string;
  };
}

/**
 * Determine if a procedure suggestion should be auto-generated
 *
 * Business Rules (from PRD Section 3.2):
 *
 * 1. IF procedura_flag = "procedura_imprecisa"
 *      → create procedure_suggestion (type=refine)
 *
 * 2. IF procedura_flag = "procedura_assente"
 *      → create procedure_suggestion (type=new_procedure)
 *
 * @param input Error data to evaluate
 * @returns Suggestion output with creation flag and data
 */
export function shouldGenerateProcedureSuggestion(
  input: ProcedureSuggestionInput
): ProcedureSuggestionOutput {
  const { procedura_flag, step_workflow, error_description, errore_id, procedure_id, error_type } =
    input;

  // Case 1: Imprecise procedure → suggest refinement
  if (procedura_flag === 'procedura_imprecisa') {
    return {
      should_create: true,
      suggestion_data: {
        procedure_id: procedure_id || undefined,
        errore_id,
        step_workflow,
        tipo_suggerimento: 'refine',
        title: generateSuggestionTitle(step_workflow, 'refine', error_type),
        description: generateSuggestionDescription(
          step_workflow,
          'refine',
          error_description
        ),
        status: 'pending',
      },
    };
  }

  // Case 2: Absent procedure → suggest new procedure creation
  if (procedura_flag === 'procedura_assente') {
    return {
      should_create: true,
      suggestion_data: {
        errore_id,
        step_workflow,
        tipo_suggerimento: 'new_procedure',
        title: generateSuggestionTitle(step_workflow, 'new_procedure', error_type),
        description: generateSuggestionDescription(
          step_workflow,
          'new_procedure',
          error_description
        ),
        status: 'pending',
      },
    };
  }

  // Case 3: Procedure is present and adequate → no suggestion needed
  return {
    should_create: false,
  };
}

/**
 * Generate a descriptive title for the procedure suggestion
 *
 * @param step Workflow step where error occurred
 * @param type Type of suggestion (refine or new_procedure)
 * @param errorType Optional error type for context
 * @returns Formatted title string
 */
function generateSuggestionTitle(
  step: StepWorkflow,
  type: TipoSuggerimento,
  errorType?: string
): string {
  const stepLabels: Record<StepWorkflow, string> = {
    accoglienza: 'Accoglienza',
    pre_controllo: 'Pre-Controllo',
    sala_controllo: 'Sala Controllo',
    preventivo_vendita: 'Preventivo/Vendita',
    ordine_materiali: 'Ordine Materiali',
    lavorazione: 'Lavorazione',
    controllo_qualita: 'Controllo Qualità',
    consegna: 'Consegna',
    post_vendita: 'Post-Vendita',
    follow_up: 'Follow-up',
  };

  const stepLabel = stepLabels[step] || step;

  if (type === 'refine') {
    return `Migliorare procedura: ${stepLabel}${errorType ? ` - ${errorType}` : ''}`;
  } else if (type === 'new_procedure') {
    return `Creare procedura mancante: ${stepLabel}${errorType ? ` - ${errorType}` : ''}`;
  }

  return `Suggerimento procedura: ${stepLabel}`;
}

/**
 * Generate a detailed description for the procedure suggestion
 *
 * @param step Workflow step
 * @param type Type of suggestion
 * @param errorDescription Original error description
 * @returns Formatted description
 */
function generateSuggestionDescription(
  step: StepWorkflow,
  type: TipoSuggerimento,
  errorDescription: string
): string {
  const stepLabels: Record<StepWorkflow, string> = {
    accoglienza: "nell'accoglienza cliente",
    pre_controllo: 'nella fase di pre-controllo',
    sala_controllo: 'in sala controllo',
    preventivo_vendita: 'durante preventivo/vendita',
    ordine_materiali: "nell'ordine dei materiali",
    lavorazione: 'in lavorazione',
    controllo_qualita: 'nel controllo qualità',
    consegna: 'durante la consegna',
    post_vendita: 'nel post-vendita',
    follow_up: 'nel follow-up',
  };

  const context = stepLabels[step] || `nella fase: ${step}`;

  if (type === 'refine') {
    return `⚠️ Procedura imprecisa rilevata ${context}.

**Errore rilevato:**
${errorDescription}

**Azione suggerita:**
Rivedere e raffinare la procedura esistente per prevenire errori simili in futuro. Considerare l'aggiunta di:
- Checklist più dettagliate
- Controlli incrociati
- Validazioni aggiuntive
- Formazione specifica

Questa proposta è stata generata automaticamente dal sistema di Error Tracking.`;
  } else if (type === 'new_procedure') {
    return `❌ Procedura mancante identificata ${context}.

**Errore rilevato:**
${errorDescription}

**Azione suggerita:**
Creare una nuova procedura documentata per gestire questo processo. La procedura dovrebbe includere:
- Passaggi operativi chiari
- Criteri di qualità
- Responsabilità definite
- Strumenti/risorse necessari

Questa proposta è stata generata automaticamente dal sistema di Error Tracking.`;
  }

  return `Suggerimento per procedura ${context}:\n\n${errorDescription}`;
}

/**
 * Get human-readable label for tipo_suggerimento
 */
export function getTipoSuggerimentoLabel(tipo: TipoSuggerimento): string {
  const labels: Record<TipoSuggerimento, string> = {
    manual: 'Manuale',
    refine: 'Raffinamento',
    new_procedure: 'Nuova Procedura',
  };

  return labels[tipo] || tipo;
}

/**
 * Get color class for tipo_suggerimento badge
 */
export function getTipoSuggerimentoColor(tipo: TipoSuggerimento): string {
  const colors: Record<TipoSuggerimento, string> = {
    manual: 'bg-gray-100 text-gray-800 ring-gray-200',
    refine: 'bg-amber-100 text-amber-800 ring-amber-200',
    new_procedure: 'bg-red-100 text-red-800 ring-red-200',
  };

  return colors[tipo] || colors.manual;
}
