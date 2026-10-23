import type { SupabaseClient } from '@supabase/supabase-js'
import { areAllOrdersCancelled } from '@/lib/buste/archiveRules'
import { giorniLavorativiTrascorsi, isSchedaFocusScaduta, oggiRoma } from './giorniLavorativi'

export interface SchedaFocusMancanteRow {
  id: string
  readable_id: string
  tipo_lavorazione: string | null
  stato_attuale: string
  cliente_nome: string
  telefono: string | null
  data_ordine: string
  giorni_lavorativi: number
  scaduta: boolean
}

/**
 * Buste con ordine effettuato e Scheda Focus non ancora fatta.
 * Restano in lista anche se consegnate; escono se cancellate (soft delete o tutti gli ordini annullati).
 * Ordinate: scadute prima, poi per data ordine crescente.
 */
export async function fetchSchedeFocusMancanti(
  supabase: SupabaseClient<any, any, any>
): Promise<{ rows: SchedaFocusMancanteRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('buste')
    .select(`
      id,
      readable_id,
      tipo_lavorazione,
      stato_attuale,
      scheda_focus_data_ordine,
      clienti (nome, cognome, telefono),
      ordini_materiali (stato, deleted_at)
    `)
    .not('scheda_focus_data_ordine', 'is', null)
    .eq('scheda_focus_fatta', false)
    .is('deleted_at', null)
    .order('scheda_focus_data_ordine', { ascending: true })

  if (error) return { rows: [], error: error.message }

  const today = oggiRoma()
  const rows: SchedaFocusMancanteRow[] = (data || [])
    .filter((b: any) => {
      const ordini = (b.ordini_materiali || []).filter((o: any) => !o.deleted_at)
      return !(ordini.length > 0 && areAllOrdersCancelled(ordini))
    })
    .map((b: any) => {
      const cliente = Array.isArray(b.clienti) ? b.clienti[0] : b.clienti
      return {
        id: b.id,
        readable_id: b.readable_id,
        tipo_lavorazione: b.tipo_lavorazione || null,
        stato_attuale: b.stato_attuale,
        cliente_nome: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : '—',
        telefono: cliente?.telefono || null,
        data_ordine: b.scheda_focus_data_ordine as string,
        giorni_lavorativi: giorniLavorativiTrascorsi(b.scheda_focus_data_ordine, today),
        scaduta: isSchedaFocusScaduta(b.scheda_focus_data_ordine, today),
      }
    })

  rows.sort((a, b) => {
    if (a.scaduta !== b.scaduta) return a.scaduta ? -1 : 1
    return a.data_ordine.localeCompare(b.data_ordine)
  })

  return { rows }
}
