// app/modules/operations/page.tsx - Operations Console (Manager/Admin)
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/context/UserContext'
import { useRouter } from 'next/navigation'
import { Package, Truck, Clock, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react'

type Cliente = { id: string; nome: string; cognome: string; telefono: string | null }
type BustaRef = { id: string; readable_id: string; stato_attuale: string; clienti: Cliente | null }
type Ordine = {
  id: string
  busta_id: string
  descrizione_prodotto: string
  stato: 'da_ordinare' | 'ordinato' | 'in_arrivo' | 'in_ritardo' | 'consegnato' | 'accettato_con_riserva' | 'rifiutato'
  da_ordinare: boolean | null
  data_ordine: string
  data_consegna_prevista: string
  data_consegna_effettiva: string | null
  note: string | null
  buste: BustaRef
}

const tabs = [
  { key: 'da_ordinare', label: 'Da ordinare', icon: Package },
  { key: 'ordinato', label: 'Ordinati', icon: Package },
  { key: 'in_arrivo', label: 'In arrivo', icon: Truck },
  { key: 'in_ritardo', label: 'In ritardo', icon: AlertTriangle },
  { key: 'all', label: 'Tutti', icon: Search },
] as const

export default function OperationsConsolePage() {
  const { user, profile, isLoading } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['key']>('da_ordinare')
  const [loading, setLoading] = useState(false)
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/login?redirectTo=/modules/operations')
      else if (profile?.role !== 'admin' && profile?.role !== 'manager') router.push('/dashboard?error=manager_required')
    }
  }, [user, profile, isLoading, router])

  const fetchOrdini = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/ordini?status=${activeTab}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore caricamento')
      setOrdini(data.ordini || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrdini() }, [activeTab])

  const updateOrdine = async (id: string, patch: Partial<Ordine>) => {
    const res = await fetch(`/api/ordini/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Errore aggiornamento')
    return data.ordine as Ordine
  }

  const markOrdinato = async (ord: Ordine) => {
    const updated = await updateOrdine(ord.id, { stato: 'ordinato', da_ordinare: false })
    setOrdini(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const markArrivato = async (ord: Ordine) => {
    const today = new Date().toISOString().slice(0,10)
    const updated = await updateOrdine(ord.id, { stato: 'consegnato', data_consegna_effettiva: today })
    setOrdini(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const setETA = async (ord: Ordine) => {
    const eta = prompt('Nuova data consegna prevista (YYYY-MM-DD):', ord.data_consegna_prevista?.slice(0,10))
    if (!eta) return
    const updated = await updateOrdine(ord.id, { data_consegna_prevista: eta })
    setOrdini(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const setNote = async (ord: Ordine) => {
    const note = prompt('Note ordine:', ord.note || '')
    if (note === null) return
    const updated = await updateOrdine(ord.id, { note })
    setOrdini(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const TabIcon = tabs.find(t => t.key === activeTab)?.icon || Package

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TabIcon className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Console Operativa</h1>
          </div>
          <button onClick={fetchOrdini} className="flex items-center gap-2 text-sm px-3 py-2 border rounded-md">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${activeTab === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Alerts */}
        {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded">{error}</div>}

        {/* Table */}
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="text-left px-4 py-2">Busta</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-left px-4 py-2">Descrizione</th>
                <th className="text-left px-4 py-2">Stato</th>
                <th className="text-left px-4 py-2">Prevista</th>
                <th className="text-left px-4 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Caricamento…</td></tr>
              ) : ordini.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nessun ordine</td></tr>
              ) : (
                ordini.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-4 py-2 font-medium text-gray-900">{o.buste?.readable_id || o.busta_id}</td>
                    <td className="px-4 py-2 text-gray-700">{o.buste?.clienti ? `${o.buste.clienti.cognome} ${o.buste.clienti.nome}` : '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{o.descrizione_prodotto}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{o.stato}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{o.data_consegna_prevista?.slice(0,10)}</td>
                    <td className="px-4 py-2 space-x-2">
                      {o.stato === 'da_ordinare' && (
                        <button onClick={() => markOrdinato(o)} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Segna ordinato</button>
                      )}
                      {o.stato !== 'consegnato' && (
                        <button onClick={() => setETA(o)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Imposta ETA</button>
                      )}
                      {o.stato !== 'consegnato' && (
                        <button onClick={() => markArrivato(o)} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Segna arrivato</button>
                      )}
                      <button onClick={() => setNote(o)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Note</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

