// ============================================
// CONSTANTS: Lens Classification and Treatments
// ============================================

/**
 * Classificazione Lenti for ordini_materiali.classificazione_lenti_id
 * These values should match the classificazione_lenti table in the database
 * Used to categorize the type of lens (Monofocali, Progressive, etc.)
 */
export const CLASSIFICAZIONE_LENTI = {
  MONOFOCALI: 'Monofocali',
  PROGRESSIVE: 'Progressive',
  OFFICE: 'Office',
  SUPPORTO_ACCOMODATIVO: 'A supporto accomodativo',
  PREVENZIONE_MIOPIA: 'Prevenzione Miopia',
} as const;

export type ClassificazioneLente = typeof CLASSIFICAZIONE_LENTI[keyof typeof CLASSIFICAZIONE_LENTI];

/**
 * Lens classifications that require an adaptation period
 * Used by RULE_2 in the survey import system
 */
export const ADAPTATION_LENS_TYPES: ClassificazioneLente[] = [
  CLASSIFICAZIONE_LENTI.PROGRESSIVE,
  CLASSIFICAZIONE_LENTI.OFFICE,
  CLASSIFICAZIONE_LENTI.SUPPORTO_ACCOMODATIVO,
];

/**
 * Lens treatments (trattamenti) for ordini_materiali.trattamenti[]
 * Multiple treatments can be selected per order
 */
export const LENS_TREATMENTS = {
  NESSUNO: 'Nessuno',
  FOTOCROMATICHE: 'Fotocromatiche',
  ANTIR: 'AntiR',
  ANTIR_PREMIUM: 'AntiR Premium',
  INDURIMENTO: 'Indurimento',
  POLARIZZATE: 'Polarizzate',
  ANTI_LUCE_BLU: 'Anti LuceBlu',
  UV400: 'UV400',
  GUIDA: 'Guida',
  SPECCHIO: 'Specchio',
  ANTI_APPANNANTE: 'Anti Appannante',
} as const;

export type LensTreatment = typeof LENS_TREATMENTS[keyof typeof LENS_TREATMENTS];

/**
 * Array of all available treatments for dropdown/multi-select
 */
export const LENS_TREATMENTS_OPTIONS: Array<{ value: LensTreatment; label: string; description?: string }> = [
  { value: LENS_TREATMENTS.NESSUNO, label: 'Nessuno', description: 'Nessun trattamento aggiuntivo' },
  { value: LENS_TREATMENTS.FOTOCROMATICHE, label: 'Fotocromatiche', description: 'Lenti che si scuriscono alla luce' },
  { value: LENS_TREATMENTS.ANTIR, label: 'AntiR', description: 'Antiriflesso standard' },
  { value: LENS_TREATMENTS.ANTIR_PREMIUM, label: 'AntiR Premium', description: 'Antiriflesso premium con maggiore resistenza' },
  { value: LENS_TREATMENTS.INDURIMENTO, label: 'Indurimento', description: 'Trattamento indurente per maggiore resistenza ai graffi' },
  { value: LENS_TREATMENTS.POLARIZZATE, label: 'Polarizzate', description: 'Filtro polarizzante per ridurre riflessi' },
  { value: LENS_TREATMENTS.ANTI_LUCE_BLU, label: 'Anti LuceBlu', description: 'Protezione dalla luce blu degli schermi' },
  { value: LENS_TREATMENTS.UV400, label: 'UV400', description: 'Protezione UV completa' },
  { value: LENS_TREATMENTS.GUIDA, label: 'Guida', description: 'Ottimizzate per la guida' },
  { value: LENS_TREATMENTS.SPECCHIO, label: 'Specchio', description: 'Trattamento a specchio' },
  { value: LENS_TREATMENTS.ANTI_APPANNANTE, label: 'Anti Appannante', description: 'Previene l\'appannamento' },
];

/**
 * Get treatment label by value
 */
export function getTreatmentLabel(value: string): string {
  const option = LENS_TREATMENTS_OPTIONS.find(opt => opt.value === value);
  return option?.label || value;
}
