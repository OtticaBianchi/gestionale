/**
 * Unit Tests for ET2.0 Assegnazione Colpa Logic
 *
 * Tests all business rules from PRD Section 3.1
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculateAssegnazioneColpa,
  validateErrorClassification,
  type ErrorClassificationInput,
} from '../assegnazioneColpa';

describe('calculateAssegnazioneColpa', () => {
  describe('Rule 1: Procedura presente + Operatore → persona', () => {
    test('should assign "persona" when procedure is present and operator is identified', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'lavorazione',
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: 'user-123',
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('persona');
    });

    test('should work for any workflow step with procedure present and operator', () => {
      const steps: ErrorClassificationInput['step_workflow'][] = [
        'accoglienza',
        'controllo_qualita',
        'consegna',
      ];

      steps.forEach((step) => {
        const result = calculateAssegnazioneColpa({
          step_workflow: step,
          procedura_flag: 'procedura_presente',
          operatore_coinvolto: 'user-456',
        });
        expect(result).toBe('persona');
      });
    });
  });

  describe('Rule 2: Procedura imprecisa → procedura', () => {
    test('should assign "procedura" when procedure is imprecise', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'lavorazione',
        procedura_flag: 'procedura_imprecisa',
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('procedura');
    });

    test('should assign "procedura" regardless of operator presence', () => {
      const withOperator = calculateAssegnazioneColpa({
        step_workflow: 'controllo_qualita',
        procedura_flag: 'procedura_imprecisa',
        operatore_coinvolto: 'user-123',
      });

      const withoutOperator = calculateAssegnazioneColpa({
        step_workflow: 'controllo_qualita',
        procedura_flag: 'procedura_imprecisa',
        operatore_coinvolto: null,
      });

      expect(withOperator).toBe('procedura');
      expect(withoutOperator).toBe('procedura');
    });
  });

  describe('Rule 3: Procedura assente → organizzazione', () => {
    test('should assign "organizzazione" when procedure is absent', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'preventivo_vendita',
        procedura_flag: 'procedura_assente',
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('organizzazione');
    });

    test('should assign "organizzazione" regardless of operator', () => {
      const withOperator = calculateAssegnazioneColpa({
        step_workflow: 'accoglienza',
        procedura_flag: 'procedura_assente',
        operatore_coinvolto: 'user-789',
      });

      const withoutOperator = calculateAssegnazioneColpa({
        step_workflow: 'accoglienza',
        procedura_flag: 'procedura_assente',
      });

      expect(withOperator).toBe('organizzazione');
      expect(withoutOperator).toBe('organizzazione');
    });
  });

  describe('Rule 4: Creato da follow-up senza operatore → non_identificabile', () => {
    test('should assign "non_identificabile" for follow-up errors without operator', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'follow_up',
        procedura_flag: 'procedura_presente',
        creato_da_followup: true,
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('non_identificabile');
    });

    test('should NOT assign "non_identificabile" if operator is present', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'follow_up',
        procedura_flag: 'procedura_presente',
        creato_da_followup: true,
        operatore_coinvolto: 'user-123',
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('persona'); // Rule 1 takes precedence
    });
  });

  describe('Rule 5: System steps senza operatore → sistemico', () => {
    test('should assign "sistemico" for ordine_materiali without operator', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'ordine_materiali',
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('sistemico');
    });

    test('should assign "sistemico" for lavorazione without operator', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'lavorazione',
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('sistemico');
    });

    test('should NOT assign "sistemico" for non-system steps', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'accoglienza', // Not a system step
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('non_identificabile'); // Fallback
    });

    test('should NOT assign "sistemico" if operator is present', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'ordine_materiali',
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: 'user-123',
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('persona'); // Rule 1 applies
    });
  });

  describe('Rule 6: Procedura presente + causa_errore cliente → cliente', () => {
    test('should assign "cliente" when customer provided wrong input and no operator is involved', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'ordine_materiali',
        procedura_flag: 'procedura_presente',
        intercettato_da: 'cliente',
        causa_errore: 'cliente',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('cliente');
    });

    test('should keep follow-up generated records as non_identificabile when operator is missing', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'follow_up',
        procedura_flag: 'procedura_presente',
        intercettato_da: 'cliente',
        causa_errore: 'cliente',
        creato_da_followup: true,
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('non_identificabile');
    });

    test('should assign "non_identificabile" when cause is external', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'ordine_materiali',
        procedura_flag: 'procedura_presente',
        causa_errore: 'esterno',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('non_identificabile');
    });
  });

  describe('Rule precedence and edge cases', () => {
    test('Rule 2 (procedura_imprecisa) should override Rule 1', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'lavorazione',
        procedura_flag: 'procedura_imprecisa',
        operatore_coinvolto: 'user-123', // Has operator
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('procedura'); // Not 'persona'
    });

    test('Rule 3 (procedura_assente) should override Rule 5', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'ordine_materiali', // System step
        procedura_flag: 'procedura_assente',
        operatore_coinvolto: null,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('organizzazione'); // Not 'sistemico'
    });

    test('should fallback to "non_identificabile" when no rules match', () => {
      const input: ErrorClassificationInput = {
        step_workflow: 'consegna',
        procedura_flag: 'procedura_presente',
        operatore_coinvolto: null,
        creato_da_followup: false,
      };

      const result = calculateAssegnazioneColpa(input);
      expect(result).toBe('non_identificabile');
    });
  });
});

describe('validateErrorClassification', () => {
  test('should pass validation for valid ET2.0 data', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      intercettato_da: 'ob_controllo_qualita',
      impatto_cliente: 'medio',
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should fail if step_workflow is missing', () => {
    const data: Partial<ErrorClassificationInput> = {
      procedura_flag: 'procedura_presente',
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('step_workflow è obbligatorio');
  });

  test('should fail if procedura_flag is missing', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('procedura_flag è obbligatorio');
  });

  test('should fail for invalid step_workflow value', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'invalid_step' as any,
      procedura_flag: 'procedura_presente',
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('step_workflow non valido'))).toBe(true);
  });

  test('should fail for invalid intercettato_da value', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      intercettato_da: 'invalid_value' as any,
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('intercettato_da non valido'))).toBe(true);
  });

  test('should fail for invalid impatto_cliente value', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      impatto_cliente: 'extra_alto' as any,
      causa_errore: 'interno',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('impatto_cliente non valido'))).toBe(true);
  });

  test('should allow null optional fields', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      intercettato_da: null,
      impatto_cliente: null,
      causa_errore: 'non_identificabile',
      operatore_coinvolto: null,
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(true);
  });

  test('should fail if causa_errore is missing', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('causa_errore è obbligatorio');
  });

  test('should fail for invalid causa_errore value', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      causa_errore: 'invalid' as any,
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('causa_errore non valida'))).toBe(true);
  });

  test('should fail if operator is set with non-internal cause', () => {
    const data: Partial<ErrorClassificationInput> = {
      step_workflow: 'lavorazione',
      procedura_flag: 'procedura_presente',
      causa_errore: 'cliente',
      operatore_coinvolto: 'user-123',
    };

    const result = validateErrorClassification(data);
    expect(result.valid).toBe(false);
    expect(
      result.errors.includes('operatore_coinvolto è consentito solo quando causa_errore è "interno"')
    ).toBe(true);
  });
});
