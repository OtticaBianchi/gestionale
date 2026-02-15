export type CallStatus =
  | 'da_chiamare'
  | 'chiamato_completato'
  | 'non_vuole_essere_contattato'
  | 'non_risponde'
  | 'cellulare_staccato'
  | 'numero_sbagliato'
  | 'richiamami'

export type SatisfactionLevel =
  | 'molto_soddisfatto'
  | 'soddisfatto'
  | 'poco_soddisfatto'
  | 'insoddisfatto'

export type CallPriority = 'alta' | 'normale' | 'bassa'
export type CallOrigin = 'post_vendita' | 'tecnico'

export interface FollowUpCall {
  id: string
  busta_id: string
  data_generazione: string
  data_chiamata?: string
  operatore_id?: string
  stato_chiamata: CallStatus
  livello_soddisfazione?: SatisfactionLevel
  categoria_cliente?: string | null // FU2.0: Auto-categorization
  note_chiamata?: string
  motivo_urgenza?: string
  origine?: CallOrigin
  orario_richiamata_da?: string
  orario_richiamata_a?: string
  scheduled_at?: string
  data_completamento?: string
  archiviato: boolean
  priorita: CallPriority
  created_at: string
  updated_at: string

  // Ambassador & Recensioni
  potenziale_ambassador?: boolean
  motivo_ambassador?: string | null
  problema_risolto?: boolean
  richiesta_recensione_google?: boolean
  link_recensione_inviato?: boolean

  // Dati correlati dalla busta/cliente
  cliente_nome: string
  cliente_cognome: string
  cliente_telefono: string
  tipo_acquisto: string
  prezzo_finale: number
  giorni_trascorsi: number
  readable_id: string
  descrizione_prodotti?: string
}

export interface CallUpdateData {
  stato_chiamata: CallStatus
  livello_soddisfazione?: SatisfactionLevel
  note_chiamata?: string
  orario_richiamata_da?: string
  orario_richiamata_a?: string
  data_chiamata?: string
  data_completamento?: string
  scheduled_at?: string
  // Ambassador & Recensioni
  potenziale_ambassador?: boolean
  motivo_ambassador?: string
  problema_risolto?: boolean
  richiesta_recensione_google?: boolean
  link_recensione_inviato?: boolean
}

export interface AmbassadorSourceStats {
  fonte_ambassador: 'survey' | 'follow_up' | 'manuale'
  totale_ambassador: number
  giorni_medi_attivazione: number
  ultimi_30gg: number
}

export interface FollowUpStatistics {
  id: string
  data_riferimento: string
  operatore_id?: string
  chiamate_totali: number
  chiamate_completate: number
  molto_soddisfatti: number
  soddisfatti: number
  poco_soddisfatti: number
  insoddisfatti: number
  non_vuole_contatto: number
  numeri_sbagliati: number
  cellulari_staccati: number
  non_risponde: number
  da_richiamare: number
  created_at: string

  // Dati operatore
  operatore_nome?: string
}

export interface StatisticsSummary {
  totale_chiamate: number
  tasso_completamento: number
  tasso_soddisfazione: number
  media_molto_soddisfatti: number
  problemi_tecnici: number
  da_richiamare_totali: number
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  da_chiamare: 'Da chiamare',
  chiamato_completato: 'Chiamata completata',
  non_vuole_essere_contattato: 'Non vuole essere contattato',
  non_risponde: 'Non risponde',
  cellulare_staccato: 'Cellulare staccato',
  numero_sbagliato: 'Numero sbagliato',
  richiamami: 'Richiamami più tardi'
}

export const SATISFACTION_LABELS: Record<SatisfactionLevel, string> = {
  molto_soddisfatto: 'Molto soddisfatto',
  soddisfatto: 'Soddisfatto',
  poco_soddisfatto: 'Poco soddisfatto',
  insoddisfatto: 'Insoddisfatto'
}

export const PRIORITY_LABELS: Record<CallPriority, string> = {
  alta: 'Alta',
  normale: 'Normale',
  bassa: 'Bassa'
}

export const PRIORITY_COLORS: Record<CallPriority, string> = {
  alta: 'bg-red-100 text-red-800',
  normale: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-green-100 text-green-800'
}

export const ORIGIN_LABELS: Record<CallOrigin, string> = {
  post_vendita: 'Post-vendita',
  tecnico: 'Tecnico'
}

// Stati che vengono considerati "completati" e devono sparire dalla lista attiva
export const COMPLETED_CALL_STATES: CallStatus[] = [
  'chiamato_completato',
  'non_vuole_essere_contattato',
  'cellulare_staccato',
  'numero_sbagliato'
]
