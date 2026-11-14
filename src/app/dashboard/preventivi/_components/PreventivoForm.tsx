'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, Link2, Loader2, Printer, Save, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  GARANZIE,
  NOMI_VERSIONI,
  NOTA_DIFFERENZE_DEFAULT,
  PRESET_PRODOTTI,
  aggiungiGiorni,
  formatDataIt,
  formatEuro,
  prezzoFinaleCella,
  round2,
  scontoPercentuale,
  totaleVersione,
  type GaranziaId,
  type PreventivoData,
  type RigaPreventivo,
  type VersionePreventivo,
  type VoceCatalogo,
} from '@/lib/preventivi/types'

interface CellaUi {
  incluso: boolean
  prezzo: string
  sconto: string // euro
  scontoPerc: string // percentuale: calcolata dall'euro (o viceversa), solo per il form
}
interface RigaUi {
  descrizione: string
  nota: string
  celle: CellaUi[]
}
interface ClienteHit {
  id: string
  nome: string | null
  cognome: string | null
  telefono: string | null
}
interface BustaHit {
  id: string
  readable_id: string
  tipo_lavorazione: string | null
  stato_attuale: string
  data_apertura: string
  aperta: boolean
}
interface PreventivoRow {
  id: string
  numero_label: string
  cliente_id: string | null
  busta_id: string | null
  busta_readable_id: string | null
  cliente_cognome: string
  cliente_nome: string
  cliente_telefono: string
  data_stipula: string
  validita_giorni: number
  versioni: VersionePreventivo[]
  righe: RigaPreventivo[]
  garanzie: GaranziaId[] | null
  note_differenze: string | null
}

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const celleToData = (celle: CellaUi[]) =>
  celle.map((c) => (c.incluso ? { prezzo_unitario: num(c.prezzo), sconto: num(c.sconto) } : null))

const cellaDi = (prezzo: number | null): CellaUi => ({
  incluso: true,
  prezzo: prezzo != null ? String(prezzo) : '',
  sconto: '',
  scontoPerc: '',
})

const strNum = (n: number) => (n > 0 ? String(n) : '')

/** Tiene allineati sconto in euro e in percentuale: l'ultimo campo toccato comanda sull'altro. */
function sincronizzaSconto(c: CellaUi, patch: Partial<CellaUi>): CellaUi {
  const next = { ...c, ...patch }
  const prezzo = num(next.prezzo)
  if ('scontoPerc' in patch) {
    const perc = Math.min(100, num(next.scontoPerc))
    next.sconto = strNum(round2((prezzo * perc) / 100))
  } else if ('sconto' in patch) {
    next.scontoPerc = strNum(scontoPercentuale(prezzo, num(next.sconto)))
  } else if ('prezzo' in patch) {
    // cambia il prezzo di partenza: lo sconto in euro resta, la percentuale si ricalcola
    next.scontoPerc = strNum(scontoPercentuale(prezzo, num(next.sconto)))
  }
  return next
}

const toData = (row: PreventivoRow): PreventivoData => ({
  numero_label: row.numero_label,
  cliente_nome: `${row.cliente_nome} ${row.cliente_cognome}`.trim(),
  cliente_telefono: row.cliente_telefono,
  data_stipula: row.data_stipula,
  validita_giorni: row.validita_giorni,
  versioni: row.versioni,
  righe: row.righe,
  garanzie: row.garanzie || [],
  note_differenze: row.note_differenze || '',
})

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch('/ob-logo.png')).blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const input =
  'rounded-md border-2 border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200'
// Caselle dei prezzi: più compatte, per lasciare spazio ai testi
const inputPrezzo =
  'rounded-md border-2 border-slate-400 bg-white px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200'
// Campo obbligatorio ancora vuoto: evidenziato in ambra
const vuoto = (v: string) => (v.trim() === '' ? ' !border-amber-500 !bg-amber-50' : '')

const TIER_STILE: Record<string, { on: string; off: string }> = {
  Base: { on: 'border-sky-600 bg-sky-600 text-white', off: 'border-sky-400 bg-sky-50 text-sky-800 hover:bg-sky-100' },
  Advanced: { on: 'border-amber-600 bg-amber-500 text-white', off: 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  Premium: { on: 'border-violet-700 bg-violet-600 text-white', off: 'border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100' },
}

// Cornice della versione consigliata: stesso colore del pulsante del livello
const TIER_CORNICE: Record<string, string> = { Base: 'border-sky-600', Advanced: 'border-amber-500', Premium: 'border-violet-600' }

// Ogni area ha una tonalità di grigio diversa, dalla più chiara (in alto) alla più scura (in basso)
const TONI_SEZIONE: Record<number, string> = {
  1: 'border-slate-200 bg-slate-50',
  2: 'border-slate-300 bg-slate-100',
  3: 'border-slate-400/70 bg-slate-200',
  4: 'border-slate-500/60 bg-slate-300/70',
}

function Sezione({ numero, titolo, children }: { numero: number; titolo: string; children: React.ReactNode }) {
  return (
    <section className={`mt-5 rounded-xl border-2 p-5 first:mt-0 ${TONI_SEZIONE[numero] ?? TONI_SEZIONE[1]}`}>
      <h3 className="mb-4 flex items-center gap-3 border-b-2 border-slate-400/50 pb-2 text-lg font-bold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-base text-white">{numero}</span>
        {titolo}
      </h3>
      {children}
    </section>
  )
}

const descBusta = (b: BustaHit) =>
  `${b.readable_id}${b.tipo_lavorazione ? ` · ${b.tipo_lavorazione}` : ''} · ${b.stato_attuale.replace(/_/g, ' ')}`

export default function PreventivoForm() {
  const [catalogo, setCatalogo] = useState<VoceCatalogo[]>([])
  const [recenti, setRecenti] = useState<PreventivoRow[]>([])
  const [ricercaRecenti, setRicercaRecenti] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [preventivoId, setPreventivoId] = useState<string | null>(null)
  const [numeroLabel, setNumeroLabel] = useState<string | null>(null)
  const [dataStipula, setDataStipula] = useState<string | null>(null)

  // Cliente
  const [cognome, setCognome] = useState('')
  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [ricercaCliente, setRicercaCliente] = useState('')
  const [hits, setHits] = useState<ClienteHit[]>([])
  const [buste, setBuste] = useState<BustaHit[]>([])
  const [bustaId, setBustaId] = useState<string | null>(null)

  // Contenuto
  const [validita, setValidita] = useState('30')
  const [versioni, setVersioni] = useState<VersionePreventivo[]>([{ nome: 'Base', consigliata: false }])
  const [righe, setRighe] = useState<RigaUi[]>([])
  const [garanzie, setGaranzie] = useState<GaranziaId[]>([])
  const [note, setNote] = useState(NOTA_DIFFERENZE_DEFAULT)

  const [linkRow, setLinkRow] = useState<PreventivoRow | null>(null)

  const multi = versioni.length > 1
  const vociDiBase = catalogo.filter((c) => c.prezzo_default != null)

  const caricaRecenti = useCallback(async (q = '') => {
    const res = await fetch(`/api/preventivi${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    if (res.ok) setRecenti((await res.json()).preventivi || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/preventivi/catalogo')
      .then((r) => (r.ok ? r.json() : { voci: [] }))
      .then((cat) => !cancelled && setCatalogo(cat.voci || []))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => caricaRecenti(ricercaRecenti.trim()), 300)
    return () => clearTimeout(t)
  }, [ricercaRecenti, caricaRecenti])

  // Ricerca cliente in anagrafica mentre si scrive (solo se non già scelto)
  useEffect(() => {
    if (clienteId || ricercaCliente.trim().length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await fetch(`/api/preventivi/clienti?q=${encodeURIComponent(ricercaCliente.trim())}`)
      if (!cancelled && res.ok) setHits((await res.json()).clienti || [])
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ricercaCliente, clienteId])

  // Buste del cliente scelto, per proporre il collegamento
  useEffect(() => {
    if (!clienteId) {
      setBuste([])
      return
    }
    let cancelled = false
    fetch(`/api/preventivi/buste?cliente_id=${clienteId}`)
      .then((r) => (r.ok ? r.json() : { buste: [] }))
      .then((j) => !cancelled && setBuste(j.buste || []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clienteId])

  const reset = () => {
    setPreventivoId(null)
    setNumeroLabel(null)
    setDataStipula(null)
    setCognome('')
    setNome('')
    setTelefono('')
    setClienteId(null)
    setRicercaCliente('')
    setBustaId(null)
    setValidita('30')
    setVersioni([{ nome: 'Base', consigliata: false }])
    setRighe([])
    setGaranzie([])
    setNote(NOTA_DIFFERENZE_DEFAULT)
  }

  const carica = (p: PreventivoRow) => {
    setPreventivoId(p.id)
    setNumeroLabel(p.numero_label)
    setDataStipula(p.data_stipula)
    setCognome(p.cliente_cognome)
    setNome(p.cliente_nome)
    setTelefono(p.cliente_telefono)
    setClienteId(p.cliente_id)
    setRicercaCliente('')
    setBustaId(p.busta_id)
    setValidita(String(p.validita_giorni))
    setVersioni(p.versioni)
    setRighe(
      p.righe.map((r) => ({
        descrizione: r.descrizione,
        nota: r.nota,
        celle: r.celle.map((c) =>
          c
            ? {
                incluso: true,
                prezzo: String(c.prezzo_unitario),
                sconto: strNum(c.sconto),
                scontoPerc: strNum(scontoPercentuale(c.prezzo_unitario, c.sconto)),
              }
            : { incluso: false, prezzo: '', sconto: '', scontoPerc: '' }
        ),
      }))
    )
    setGaranzie(p.garanzie || [])
    setNote(p.note_differenze || NOTA_DIFFERENZE_DEFAULT)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scegliCliente = (c: ClienteHit) => {
    setClienteId(c.id)
    setCognome(c.cognome || '')
    setNome(c.nome || '')
    if (c.telefono) setTelefono(c.telefono)
    setHits([])
    setBustaId(null)
  }

  const cambiaCliente = () => {
    setClienteId(null)
    setBustaId(null)
    setRicercaCliente('')
  }

  // ── Versioni (livelli) ───────────────────────────────────────
  // Si sceglie liberamente quali livelli confrontare (anche uno solo): le colonne restano sempre in ordine Base, Advanced, Premium.
  const toggleLivello = (livello: string) => {
    const idx = versioni.findIndex((v) => v.nome === livello)
    if (idx >= 0) {
      if (versioni.length === 1) return // ne serve almeno uno
      setVersioni((prev) => {
        const resto = prev.filter((_, i) => i !== idx)
        return resto.length === 1 ? [{ ...resto[0], consigliata: false, motivo_consigliata: '' }] : resto
      })
      setRighe((prev) => prev.map((r) => ({ ...r, celle: r.celle.filter((_, i) => i !== idx) })))
      return
    }
    const ordine = NOMI_VERSIONI.indexOf(livello)
    const pos = versioni.filter((v) => NOMI_VERSIONI.indexOf(v.nome) < ordine).length
    setVersioni((prev) => [...prev.slice(0, pos), { nome: livello, consigliata: false }, ...prev.slice(pos)])
    // il nuovo livello parte come copia del primo già presente, poi l'operatore cambia i prezzi
    setRighe((prev) =>
      prev.map((r) => {
        const copia = { ...(r.celle[0] ?? cellaDi(null)) }
        return { ...r, celle: [...r.celle.slice(0, pos), copia, ...r.celle.slice(pos)] }
      })
    )
  }

  const aggiornaVersione = (i: number, patch: Partial<VersionePreventivo>) =>
    setVersioni((prev) =>
      prev.map((v, idx) => {
        if (idx === i) return { ...v, ...patch }
        // una sola versione può essere consigliata
        return patch.consigliata ? { ...v, consigliata: false, motivo_consigliata: '' } : v
      })
    )

  // ── Righe ───────────────────────────────────────────────────
  const nuovaRiga = (descrizione: string, prezzo: number | null): RigaUi => ({
    descrizione,
    nota: '',
    celle: versioni.map(() => cellaDi(prezzo)),
  })

  const aggiungiDaCatalogo = (c: VoceCatalogo) => {
    setRighe((prev) => [...prev, nuovaRiga(c.nome, c.prezzo_default)])
    if (c.garanzia_adattamento) setGaranzie((prev) => (prev.includes('adattamento') ? prev : [...prev, 'adattamento']))
  }

  const aggiornaRiga = (i: number, patch: Partial<RigaUi>) =>
    setRighe((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const aggiornaCella = (i: number, v: number, patch: Partial<CellaUi>) =>
    setRighe((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, celle: r.celle.map((c, k) => (k === v ? sincronizzaSconto(c, patch) : c)) } : r))
    )

  const rimuoviRiga = (i: number) => setRighe((prev) => prev.filter((_, idx) => idx !== i))

  const applicaPreset = (id: string) => {
    const preset = PRESET_PRODOTTI.find((p) => p.id === id)
    if (!preset) return
    if (righe.length > 0 && !window.confirm('Sostituire le voci attuali con quelle del tipo scelto?')) return
    const nuove = preset.voci.map((nomeVoce) => {
      const c = catalogo.find((x) => x.nome.toLowerCase() === nomeVoce.toLowerCase())
      return nuovaRiga(c?.nome ?? nomeVoce, c?.prezzo_default ?? null)
    })
    setRighe(nuove)
    setGaranzie(preset.garanzie)
  }

  const toggleGaranzia = (id: GaranziaId) =>
    setGaranzie((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  // ── Salvataggio / PDF ───────────────────────────────────────
  const payload = () => ({
    cliente_id: clienteId,
    busta_id: bustaId,
    cliente_cognome: cognome,
    cliente_nome: nome,
    cliente_telefono: telefono,
    validita_giorni: parseInt(validita, 10),
    versioni: versioni.map((v) => (v.consigliata ? v : { nome: v.nome, consigliata: false })),
    righe: righe.map((r) => ({ descrizione: r.descrizione, nota: r.nota, celle: celleToData(r.celle) })),
    garanzie,
    note_differenze: multi ? note : '',
  })

  const salva = async (comeNuovo = false): Promise<PreventivoRow | null> => {
    const update = preventivoId && !comeNuovo
    const res = await fetch(update ? `/api/preventivi/${preventivoId}` : '/api/preventivi', {
      method: update ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error || 'Errore salvataggio preventivo')
      return null
    }
    const p: PreventivoRow = json.preventivo
    setPreventivoId(p.id)
    setNumeroLabel(p.numero_label)
    setDataStipula(p.data_stipula)
    await caricaRecenti(ricercaRecenti.trim())
    return p
  }

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e: any) {
      toast.error(e?.message || 'Errore')
    } finally {
      setBusy(false)
    }
  }

  const buildPdf = async (p: PreventivoRow) => {
    const { generaPreventivoPdf, nomeFilePreventivo } = await import('@/lib/preventivi/pdf')
    const data = toData(p)
    return { doc: generaPreventivoPdf(data, await logoDataUrl()), nomeFile: nomeFilePreventivo(data) }
  }

  const salvaSolo = (comeNuovo: boolean) =>
    run(async () => {
      const p = await salva(comeNuovo)
      if (p) toast.success(`Preventivo ${p.numero_label} salvato`)
    })

  const scarica = () =>
    run(async () => {
      const p = await salva()
      if (!p) return
      const { doc, nomeFile } = await buildPdf(p)
      doc.save(nomeFile)
    })

  const stampa = () =>
    run(async () => {
      const p = await salva()
      if (!p) return
      const { doc } = await buildPdf(p)
      doc.autoPrint()
      window.open(doc.output('bloburl') as unknown as string, '_blank')
    })

  const scaricaSalvato = (p: PreventivoRow) =>
    run(async () => {
      const { doc, nomeFile } = await buildPdf(p)
      doc.save(nomeFile)
    })

  const collega = async (p: PreventivoRow, nuovaBustaId: string | null) => {
    const res = await fetch(`/api/preventivi/${p.id}/collega`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busta_id: nuovaBustaId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error || 'Errore collegamento')
      return
    }
    toast.success(nuovaBustaId ? 'Preventivo collegato alla busta' : 'Preventivo scollegato')
    setLinkRow(null)
    if (preventivoId === p.id) setBustaId(nuovaBustaId)
    await caricaRecenti(ricercaRecenti.trim())
  }

  const scadenza = useMemo(() => {
    const giorni = parseInt(validita, 10)
    return dataStipula && giorni > 0 ? aggiungiGiorni(dataStipula, giorni) : null
  }, [dataStipula, validita])

  const clienteOk = cognome.trim() !== '' && nome.trim() !== '' && telefono.trim() !== ''
  const righeOk =
    righe.length > 0 &&
    righe.every((r) => r.descrizione.trim() !== '' && r.celle.every((c) => !c.incluso || c.prezzo.trim() !== '')) &&
    versioni.every((_, i) => righe.some((r) => r.celle[i]?.incluso))
  const consiglioOk = versioni.every((v) => !v.consigliata || (v.motivo_consigliata ?? '').trim() !== '')
  const pronto = clienteOk && righeOk && consiglioOk

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const campoCliente = (
    etichetta: string,
    valore: string,
    onChange: (v: string) => void,
    opts: { cerca?: boolean; tel?: boolean } = {}
  ) => {
    const bloccato = Boolean(clienteId) && !opts.tel
    return (
      <label className="block">
        <span className="mb-1 block text-base font-semibold text-slate-800">
          {etichetta} <span className="text-red-600">*</span>
        </span>
        <input
          className={`${input} w-full ${bloccato ? '!bg-slate-100' : vuoto(valore)}`}
          inputMode={opts.tel ? 'tel' : undefined}
          placeholder={etichetta}
          value={valore}
          readOnly={bloccato}
          onChange={(e) => {
            onChange(e.target.value)
            if (opts.cerca) setRicercaCliente(e.target.value)
          }}
        />
      </label>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-slate-300 bg-white p-6 shadow-md">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold text-slate-900">{numeroLabel ? `Preventivo ${numeroLabel}` : 'Nuovo preventivo'}</h2>
          {numeroLabel && (
            <button type="button" onClick={reset} className="text-base font-medium text-blue-700 hover:underline">
              + Nuovo preventivo
            </button>
          )}
        </div>

        <Sezione numero={1} titolo="Cliente">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {campoCliente('Cognome', cognome, setCognome, { cerca: true })}
            {campoCliente('Nome', nome, setNome, { cerca: true })}
            {campoCliente('Cellulare', telefono, (v) => { setTelefono(v); if (!clienteId) setRicercaCliente(v) }, { tel: true })}
          </div>

          {clienteId ? (
            <p className="mt-3 flex flex-wrap items-center gap-3 text-base font-medium text-emerald-700">
              ✓ Cliente già in anagrafica: dati presi da lì.
              <button type="button" onClick={cambiaCliente} className="text-blue-700 underline">
                Non è lui / cambia
              </button>
            </p>
          ) : hits.length > 0 ? (
            <div className="mt-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
              <p className="mb-2 text-base font-semibold text-amber-900">Già in anagrafica? Clicca per usare i suoi dati:</p>
              <ul className="space-y-2">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => scegliCliente(h)}
                      className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-base hover:bg-amber-100"
                    >
                      {h.cognome} {h.nome} {h.telefono ? `· ${h.telefono}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Se il cliente è già in anagrafica lo proponiamo mentre scrivi. Il preventivo non crea nessun cliente.
            </p>
          )}

          {clienteId && buste.length > 0 && (
            <div className="mt-4 rounded-lg border-2 border-slate-300 bg-white p-3">
              <p className="mb-2 text-base font-semibold text-slate-800">
                Collegare il preventivo a una busta di questo cliente? (facoltativo)
              </p>
              <ul className="space-y-2">
                {buste.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-center gap-3 text-base">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={bustaId === b.id}
                        onChange={() => setBustaId(bustaId === b.id ? null : b.id)}
                      />
                      <span>
                        {descBusta(b)}{' '}
                        {b.aperta ? <em className="text-emerald-700">(aperta)</em> : <em className="text-slate-500">(chiusa)</em>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-slate-600">Se riguarda un altro lavoro, lascia tutto non spuntato.</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3 text-base font-semibold text-slate-800">
              Validità (giorni)
              <input type="number" min={1} className={`${input} w-24`} value={validita} onChange={(e) => setValidita(e.target.value)} />
            </label>
            <span className="text-sm text-slate-600">
              {dataStipula
                ? `Data di stipula ${formatDataIt(dataStipula)}${scadenza ? ` · valido fino al ${formatDataIt(scadenza)}` : ''}`
                : 'Numero e data di stipula vengono assegnati al primo salvataggio.'}
            </span>
          </div>
        </Sezione>

        <Sezione numero={2} titolo="Tipo di preventivo e garanzie">
          <p className="mb-2 text-base font-semibold text-slate-800">Che cosa preventivi? (precompila voci e garanzie)</p>
          <div className="flex flex-wrap gap-3">
            {PRESET_PRODOTTI.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applicaPreset(p.id)}
                className="rounded-lg border-2 border-violet-400 bg-violet-50 px-5 py-3 text-base font-semibold text-violet-900 hover:bg-violet-100"
              >
                {p.label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-5 text-base font-semibold text-slate-800">Garanzie da mostrare nel preventivo</p>
          <div className="flex flex-wrap gap-3">
            {GARANZIE.map((g) => {
              const on = garanzie.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGaranzia(g.id)}
                  aria-pressed={on}
                  className={`rounded-lg border-2 px-5 py-3 text-base font-semibold transition-colors ${
                    on ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {g.label}
                </button>
              )
            })}
          </div>
        </Sezione>

        <Sezione numero={3} titolo="Quali versioni vuoi proporre?">
          <p className="mb-2 text-sm text-slate-600">
            Scegli uno o più livelli: anche uno solo. Con più livelli il PDF esce in orizzontale, con le versioni affiancate.
          </p>
          <div className="flex flex-wrap gap-3">
            {NOMI_VERSIONI.map((livello) => {
              const on = versioni.some((v) => v.nome === livello)
              const stile = TIER_STILE[livello]
              return (
                <button
                  key={livello}
                  type="button"
                  onClick={() => toggleLivello(livello)}
                  aria-pressed={on}
                  className={`min-w-[10rem] rounded-xl border-2 px-6 py-4 text-xl font-bold transition-colors ${on ? stile.on : stile.off}`}
                >
                  {on ? '✓ ' : ''}
                  {livello}
                </button>
              )
            })}
          </div>
        </Sezione>

        <Sezione numero={4} titolo="Voci e prezzi">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-base">
              <thead>
                <tr>
                  <th className="w-[32%] min-w-[14rem] p-1 text-left text-sm font-semibold text-slate-700">Voce *</th>
                  {versioni.map((v, i) => (
                    <th key={i} colSpan={4} className="border-l-2 border-slate-300 p-1">
                      <div
                        className={`flex flex-wrap items-center justify-center gap-3 rounded-xl border-4 p-1 ${
                          multi && v.consigliata ? (TIER_CORNICE[v.nome] ?? 'border-slate-700') : 'border-transparent'
                        }`}
                      >
                        <span
                          className={`rounded-lg px-4 py-1.5 text-lg font-bold ${TIER_STILE[v.nome]?.on ?? 'border-slate-700 bg-slate-700 text-white'}`}
                        >
                          {v.nome}
                        </span>
                        {multi && (
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input type="checkbox" className="h-4 w-4" checked={v.consigliata} onChange={(e) => aggiornaVersione(i, { consigliata: e.target.checked })} />
                            consigliata
                          </label>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
                <tr className="text-sm text-slate-600">
                  <th />
                  {versioni.map((_, i) => (
                    <FragmentTh key={i} />
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {righe.map((r, i) => (
                  <RigaRows
                    key={i}
                    riga={r}
                    multi={multi}
                    onChange={(patch) => aggiornaRiga(i, patch)}
                    onCella={(v, patch) => aggiornaCella(i, v, patch)}
                    onRemove={() => rimuoviRiga(i)}
                  />
                ))}
                {righe.length === 0 && (
                  <tr>
                    <td colSpan={versioni.length * 4 + 2} className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-center text-base font-medium text-amber-900">
                      Nessuna voce: scegli il tipo di preventivo sopra, una voce di base qui sotto, oppure aggiungi una voce.
                    </td>
                  </tr>
                )}
              </tbody>
              {righe.length > 0 && (
                <tfoot>
                  <tr className="border-t-4 border-slate-400 text-lg font-bold">
                    <td className="p-2">Totale</td>
                    {versioni.map((_, i) => (
                      <td key={i} colSpan={4} className="border-l-2 border-slate-300 p-2 text-right">
                        {formatEuro(totaleVersione(righe.map((r) => ({ celle: celleToData(r.celle) })), i))}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-4 space-y-3">
            {vociDiBase.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base font-semibold text-slate-800">Voci di base:</span>
                {vociDiBase.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => aggiungiDaCatalogo(c)}
                    className="rounded-lg border-2 border-blue-500 bg-blue-50 px-5 py-3 text-base font-semibold text-blue-900 hover:bg-blue-100"
                  >
                    + {c.nome} ({formatEuro(c.prezzo_default as number)})
                  </button>
                ))}
              </div>
            )}
            <select
              className={`${input} font-semibold`}
              value=""
              onChange={(e) => {
                const val = e.target.value
                if (!val) return
                if (val === '__libera') setRighe((prev) => [...prev, nuovaRiga('', null)])
                else {
                  const c = catalogo.find((x) => x.id === val)
                  if (c) aggiungiDaCatalogo(c)
                }
              }}
            >
              <option value="">+ Aggiungi altra voce…</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.prezzo_default != null ? ` (${formatEuro(c.prezzo_default)})` : ''}
                </option>
              ))}
              <option value="__libera">Voce libera (scrivi tu il nome)</option>
            </select>
          </div>

          {multi && (
            <label className="mt-5 block">
              <span className="mb-1 block text-base font-semibold text-slate-800">Nota: perché le versioni differiscono</span>
              <textarea rows={3} className={`${input} w-full`} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}

          {multi &&
            versioni.map((v, i) =>
              v.consigliata ? (
                <label key={i} className="mt-5 block">
                  <span className="mb-1 block text-base font-semibold text-slate-800">
                    Perché consigliamo la versione {v.nome} <span className="text-red-600">*</span>
                    <span className="ml-2 text-sm font-normal text-slate-600">(compare in fondo al preventivo)</span>
                  </span>
                  <textarea
                    rows={3}
                    className={`${input} w-full${vuoto(v.motivo_consigliata ?? '')}`}
                    placeholder="Spiega al cliente perché questa è la soluzione più adatta a lui"
                    value={v.motivo_consigliata ?? ''}
                    onChange={(e) => aggiornaVersione(i, { motivo_consigliata: e.target.value })}
                  />
                </label>
              ) : null
            )}
        </Sezione>

        <div className="mt-8 flex flex-wrap gap-3 border-t-2 border-slate-200 pt-5">
          <button
            type="button"
            disabled={busy || !pronto}
            onClick={() => salvaSolo(false)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Salva
          </button>
          <button
            type="button"
            disabled={busy || !pronto}
            onClick={scarica}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <Download className="h-5 w-5" /> Salva e scarica PDF
          </button>
          <button
            type="button"
            disabled={busy || !pronto}
            onClick={stampa}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-400 bg-white px-6 py-3 text-base font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
          >
            <Printer className="h-5 w-5" /> Stampa
          </button>
          {preventivoId && (
            <button
              type="button"
              disabled={busy || !pronto}
              onClick={() => salvaSolo(true)}
              className="rounded-lg border-2 border-slate-400 bg-white px-6 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
            >
              Salva come nuovo preventivo
            </button>
          )}
        </div>
        {!pronto && (
          <p className="mt-3 text-base font-medium text-amber-800">
            Per salvare servono: cognome, nome, cellulare, almeno una voce con il prezzo per ogni versione e, se c'è una versione consigliata, il motivo del consiglio (i campi gialli sono ancora da compilare).
          </p>
        )}
      </div>

      {/* Preventivi recenti */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" /> Preventivi recenti
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
            <input className={`${input} pl-8`} placeholder="Cerca per nome" value={ricercaRecenti} onChange={(e) => setRicercaRecenti(e.target.value)} />
          </div>
        </div>
        {recenti.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">Nessun preventivo.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recenti.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{p.numero_label}</strong> · {p.cliente_cognome} {p.cliente_nome} · {formatDataIt(p.data_stipula)} ·{' '}
                  {p.versioni.length > 1 ? `${p.versioni.length} versioni` : formatEuro(totaleVersione(p.righe, 0))}
                  {p.busta_readable_id && (
                    <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      busta {p.busta_readable_id}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => carica(p)} className="text-blue-600 hover:underline">
                    Apri / modifica
                  </button>
                  <button type="button" onClick={() => scaricaSalvato(p)} className="text-blue-600 hover:underline">
                    PDF
                  </button>
                  {p.busta_id ? (
                    <button type="button" onClick={() => collega(p, null)} className="text-slate-500 hover:underline">
                      Scollega
                    </button>
                  ) : (
                    <button type="button" onClick={() => setLinkRow(p)} className="flex items-center gap-1 text-blue-600 hover:underline">
                      <Link2 className="h-3.5 w-3.5" /> Collega a busta
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {linkRow && <CollegaDialog preventivo={linkRow} onClose={() => setLinkRow(null)} onScegli={(bustaId) => collega(linkRow, bustaId)} />}
    </div>
  )
}

function FragmentTh() {
  return (
    <>
      <th className="border-l-2 border-slate-300 p-1 text-right text-xs font-medium">Unitario €</th>
      <th className="p-1 text-right text-xs font-medium">Sconto €</th>
      <th className="p-1 text-right text-xs font-medium">Sconto %</th>
      <th className="p-1 text-right text-xs font-medium">Finale</th>
    </>
  )
}

function RigaRows({
  riga,
  multi,
  onChange,
  onCella,
  onRemove,
}: {
  riga: RigaUi
  multi: boolean
  onChange: (patch: Partial<RigaUi>) => void
  onCella: (versione: number, patch: Partial<CellaUi>) => void
  onRemove: () => void
}) {
  const colonne = riga.celle.length * 4 + 2
  return (
    <>
      <tr className="border-t-2 border-slate-200 align-middle">
        <td className="p-1">
          <input
            className={`${input} w-full font-semibold${vuoto(riga.descrizione)}`}
            placeholder="Nome della voce"
            value={riga.descrizione}
            onChange={(e) => onChange({ descrizione: e.target.value })}
          />
        </td>
        {riga.celle.map((c, v) =>
          c.incluso ? (
            <CellaInputs key={v} cella={c} multi={multi} onChange={(patch) => onCella(v, patch)} />
          ) : (
            <td key={v} colSpan={4} className="border-l-2 border-slate-300 p-1 text-center text-sm text-slate-500">
              non incluso{' '}
              <button type="button" onClick={() => onCella(v, { incluso: true })} className="font-semibold text-blue-700 underline">
                includi
              </button>
            </td>
          )
        )}
        <td className="p-1 text-center">
          <button type="button" onClick={onRemove} className="text-red-600 hover:text-red-800" title="Rimuovi voce">
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={colonne} className="px-1 pb-2">
          <input
            className={`${input} w-full text-sm italic`}
            placeholder="Nota descrittiva sotto la voce (facoltativa)"
            maxLength={300}
            value={riga.nota}
            onChange={(e) => onChange({ nota: e.target.value })}
          />
        </td>
      </tr>
    </>
  )
}

function CellaInputs({ cella, multi, onChange }: { cella: CellaUi; multi: boolean; onChange: (patch: Partial<CellaUi>) => void }) {
  const finale = prezzoFinaleCella({ prezzo_unitario: num(cella.prezzo), sconto: num(cella.sconto) })
  return (
    <>
      <td className="border-l-2 border-slate-300 p-1">
        <input
          className={`${inputPrezzo} w-full min-w-[3.75rem] text-right font-semibold${vuoto(cella.prezzo)}`}
          inputMode="decimal"
          placeholder="€"
          value={cella.prezzo}
          onChange={(e) => onChange({ prezzo: e.target.value })}
        />
      </td>
      <td className="p-1">
        <input
          className={`${inputPrezzo} w-full min-w-[3.75rem] text-right`}
          inputMode="decimal"
          placeholder="0"
          value={cella.sconto}
          onChange={(e) => onChange({ sconto: e.target.value })}
        />
      </td>
      <td className="p-1">
        <input
          className={`${inputPrezzo} w-full min-w-[3.25rem] text-right`}
          inputMode="decimal"
          placeholder="0"
          value={cella.scontoPerc}
          onChange={(e) => onChange({ scontoPerc: e.target.value })}
        />
      </td>
      <td className="whitespace-nowrap p-1 text-right text-sm font-bold">
        {formatEuro(finale)}
        {multi && (
          <button type="button" onClick={() => onChange({ incluso: false })} className="ml-1 align-middle text-slate-400 hover:text-red-600" title="Non incluso in questa versione">
            <X className="inline h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </>
  )
}

function CollegaDialog({
  preventivo,
  onClose,
  onScegli,
}: {
  preventivo: PreventivoRow
  onClose: () => void
  onScegli: (bustaId: string) => void
}) {
  const [q, setQ] = useState(preventivo.cliente_telefono || preventivo.cliente_cognome)
  const [clienti, setClienti] = useState<ClienteHit[]>([])
  const [cliente, setCliente] = useState<string | null>(preventivo.cliente_id)
  const [buste, setBuste] = useState<BustaHit[]>([])

  useEffect(() => {
    if (cliente || q.trim().length < 2) return
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await fetch(`/api/preventivi/clienti?q=${encodeURIComponent(q.trim())}`)
      if (!cancelled && res.ok) setClienti((await res.json()).clienti || [])
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, cliente])

  useEffect(() => {
    if (!cliente) return
    let cancelled = false
    fetch(`/api/preventivi/buste?cliente_id=${cliente}`)
      .then((r) => (r.ok ? r.json() : { buste: [] }))
      .then((j) => !cancelled && setBuste(j.buste || []))
    return () => {
      cancelled = true
    }
  }, [cliente])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Collega {preventivo.numero_label} a una busta</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!cliente ? (
          <>
            <p className="mb-2 text-sm text-slate-600">Cerca il cliente in anagrafica (cognome o cellulare):</p>
            <input className={`${input} w-full`} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <ul className="mt-2 space-y-1">
              {clienti.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setCliente(c.id)} className="w-full rounded bg-slate-50 px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                    {c.cognome} {c.nome} {c.telefono ? `· ${c.telefono}` : ''}
                  </button>
                </li>
              ))}
              {clienti.length === 0 && q.trim().length >= 2 && <li className="text-sm text-slate-500">Nessun cliente trovato.</li>}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-600">Scegli la busta:</p>
            <ul className="space-y-1">
              {buste.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => onScegli(b.id)} className="w-full rounded bg-slate-50 px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                    {descBusta(b)} {b.aperta ? '(aperta)' : '(chiusa)'}
                  </button>
                </li>
              ))}
              {buste.length === 0 && <li className="text-sm text-slate-500">Questo cliente non ha buste.</li>}
            </ul>
            <button type="button" onClick={() => setCliente(null)} className="mt-3 text-sm text-blue-600 hover:underline">
              ← Cerca un altro cliente
            </button>
          </>
        )}
      </div>
    </div>
  )
}
