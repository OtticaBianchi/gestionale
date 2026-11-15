import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  GARANZIE,
  aggiungiGiorni,
  importoPreventivo,
  type GaranziaId,
  type PreventivoAttesaRow,
  type RigaPreventivo,
  type TipoPreventivo,
  type VersionePreventivo,
} from './types'

export const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function requireUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export const unauthorized = () => NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

export const oggiRomaIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())

/** Ritorna un messaggio d'errore se busta_id è indicato ma la busta non esiste. */
export async function verificaBusta(bustaId: string | null): Promise<string | null> {
  if (!bustaId) return null
  const { data } = await adminClient().from('buste').select('id').eq('id', bustaId).is('deleted_at', null).maybeSingle()
  return data ? null : 'Busta non trovata'
}

export interface PreventivoInput {
  cliente_id: string | null
  busta_id: string | null
  cliente_cognome: string
  cliente_nome: string
  cliente_telefono: string
  validita_giorni: number
  versioni: VersionePreventivo[]
  righe: RigaPreventivo[]
  garanzie: GaranziaId[]
  note_differenze: string | null
  tipo: TipoPreventivo | null
}

/** Valida e normalizza il payload di un preventivo. Ritorna `error` oppure `value`. */
export function parsePreventivoBody(body: any): { error: string } | { value: PreventivoInput } {
  if (!body || typeof body !== 'object') return { error: 'Payload non valido' }

  const cliente_cognome = String(body.cliente_cognome ?? '').trim()
  const cliente_nome = String(body.cliente_nome ?? '').trim()
  const cliente_telefono = String(body.cliente_telefono ?? '').trim()
  if (!cliente_cognome || !cliente_nome || !cliente_telefono) {
    return { error: 'Cognome, nome e cellulare sono obbligatori' }
  }

  const validita = Number(body.validita_giorni ?? 30)
  if (!Number.isInteger(validita) || validita < 1 || validita > 365) return { error: 'Validità non valida' }

  if (!Array.isArray(body.versioni) || body.versioni.length < 1 || body.versioni.length > 3) {
    return { error: 'Servono da 1 a 3 versioni' }
  }
  const nVersioni = body.versioni.length
  const versioni: VersionePreventivo[] = body.versioni.map((v: any) => ({
    nome: String(v?.nome ?? '').trim() || 'Soluzione',
    consigliata: Boolean(v?.consigliata),
    ...(v?.consigliata ? { motivo_consigliata: String(v?.motivo_consigliata ?? '').trim().slice(0, 600) } : {}),
  }))
  if (versioni.filter((v) => v.consigliata).length > 1) return { error: 'Si può consigliare una sola versione' }

  if (!Array.isArray(body.righe) || body.righe.length < 1) return { error: 'Inserisci almeno una voce' }
  const righe: RigaPreventivo[] = []
  for (const r of body.righe) {
    const descrizione = String(r?.descrizione ?? '').trim()
    if (!descrizione) return { error: 'Ogni voce deve avere una descrizione' }
    if (!Array.isArray(r?.celle) || r.celle.length !== nVersioni) return { error: `Celle non valide per "${descrizione}"` }
    const celle = []
    for (const c of r.celle) {
      if (c === null) {
        celle.push(null)
        continue
      }
      const prezzo = Number(c?.prezzo_unitario)
      const sconto = Number(c?.sconto ?? 0)
      if (!Number.isFinite(prezzo) || prezzo < 0) return { error: `Prezzo non valido per "${descrizione}"` }
      if (!Number.isFinite(sconto) || sconto < 0 || sconto > prezzo) return { error: `Sconto non valido per "${descrizione}"` }
      celle.push({ prezzo_unitario: prezzo, sconto })
    }
    righe.push({ descrizione, nota: String(r?.nota ?? '').trim().slice(0, 300), celle })
  }
  for (let i = 0; i < nVersioni; i++) {
    if (!righe.some((r) => r.celle[i] !== null)) return { error: `La versione "${versioni[i].nome}" non ha nessuna voce` }
  }

  const garanzieValide = GARANZIE.map((g) => g.id)
  const garanzie = (Array.isArray(body.garanzie) ? body.garanzie : []).filter((g: unknown): g is GaranziaId =>
    garanzieValide.includes(g as GaranziaId)
  )

  const idOrNull = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : null)
  return {
    value: {
      cliente_id: idOrNull(body.cliente_id),
      busta_id: idOrNull(body.busta_id),
      cliente_cognome,
      cliente_nome,
      cliente_telefono,
      validita_giorni: validita,
      versioni,
      righe,
      garanzie,
      note_differenze: String(body.note_differenze ?? '').trim() || null,
      tipo: body.tipo === 'lenti_graduate' || body.tipo === 'occhiali_completi' ? body.tipo : null,
    },
  }
}

const cifre = (t: string | null | undefined) => (t || '').replace(/\D/g, '')

/** Stesso cliente? Per id, per cellulare (ultime 9 cifre) o per cognome+nome: il preventivo non crea il cliente in anagrafica. */
export function stessoCliente(
  p: { cliente_id: string | null; cliente_telefono: string; cliente_cognome: string; cliente_nome: string },
  q: { cliente_id?: string | null; telefono?: string | null; cognome?: string | null; nome?: string | null }
): boolean {
  if (q.cliente_id && p.cliente_id === q.cliente_id) return true
  const t1 = cifre(p.cliente_telefono)
  const t2 = cifre(q.telefono)
  if (t1.length >= 7 && t2.length >= 7 && t1.slice(-9) === t2.slice(-9)) return true
  const norm = (x: string | null | undefined) => (x || '').trim().toLowerCase()
  return Boolean(norm(q.cognome) && norm(q.nome) && norm(p.cliente_cognome) === norm(q.cognome) && norm(p.cliente_nome) === norm(q.nome))
}

/** Elenco dei preventivi ancora in attesa, dal più vecchio, per il report da stampare. */
export async function fetchPreventiviInAttesa(): Promise<{ rows: PreventivoAttesaRow[]; error: string | null }> {
  const { data, error } = await adminClient()
    .from('preventivi')
    .select('id, numero_label, cliente_cognome, cliente_nome, cliente_telefono, tipo, data_stipula, validita_giorni, versioni, righe')
    .eq('esito', 'in_attesa')
    .is('busta_id', null)
    .order('data_stipula', { ascending: true })
    .limit(500)
  if (error) return { rows: [], error: error.message }

  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
  const giorniTra = (da: string, a: string) =>
    Math.round((new Date(a + 'T12:00:00').getTime() - new Date(da.slice(0, 10) + 'T12:00:00').getTime()) / 86400000)

  const rows = (data || []).map((p: any): PreventivoAttesaRow => {
    const scadenza = aggiungiGiorni(String(p.data_stipula).slice(0, 10), p.validita_giorni)
    return {
      id: p.id,
      numero_label: p.numero_label,
      cliente_nome: `${p.cliente_cognome} ${p.cliente_nome}`.trim(),
      telefono: p.cliente_telefono,
      tipo: p.tipo,
      data_stipula: String(p.data_stipula).slice(0, 10),
      scadenza,
      giorni: giorniTra(p.data_stipula, oggi),
      scaduto: scadenza < oggi,
      importo: importoPreventivo(p),
    }
  })
  return { rows, error: null }
}
