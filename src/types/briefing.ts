export type BriefingSezione = 'urgenze' | 'flusso_inceppato' | 'materiali_ritardo' | 'manuale'

export interface BriefingSnapshot {
  id: string
  data_briefing: string
  generato_da: string
  generato_da_profile?: { full_name: string }
  note_generali: string | null
  created_at: string
  updated_at: string
  tasks?: BriefingTask[]
}

export interface BriefingTask {
  id: string
  snapshot_id: string
  busta_id: string
  sezione: BriefingSezione
  motivo: string
  assegnato_a: string | null
  assegnato_a_profile?: { full_name: string }
  nota_admin: string | null
  risolto: boolean
  created_at: string
  updated_at: string
  busta?: {
    readable_id: string
    tipo_lavorazione: string
    stato_attuale: string
    priorita: string
    note_generali: string | null
    updated_at: string
    clienti?: {
      nome: string
      cognome: string
      telefono: string | null
    }
  }
}

// Dato grezzo restituito da /api/briefing/alerts (senza snapshot_id, solo per preview)
export interface AlertBusta {
  busta_id: string
  readable_id: string
  tipo_lavorazione: string
  stato_attuale: string
  priorita: string
  note_generali: string | null
  ore_in_stato: number
  sezione: BriefingSezione
  motivo: string
  cliente_nome: string
  cliente_cognome: string
  cliente_telefono: string | null
}
