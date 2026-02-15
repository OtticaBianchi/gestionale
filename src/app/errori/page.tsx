'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Plus, FileText, Download, Eye, Filter, ChevronDown, ArrowLeft } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import QuickAddErrorForm from '@/components/error-tracking/QuickAddErrorForm'
import LetteraRichiamoModal from '@/components/error-tracking/LetteraRichiamoModal'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type ErrorData = {
  id: string
  busta_id: string | null
  error_type: string
  error_category: 'critico' | 'medio' | 'basso'
  error_description: string
  cost_amount: number
  cost_type: 'real' | 'estimate'
  cost_detail: string | null
  client_impacted: boolean
  requires_reorder: boolean
  reported_at: string
  resolution_status: string
  time_lost_minutes: number
  cliente_id?: string | null
  step_workflow?: string | null
  intercettato_da?: string | null
  procedura_flag?: string | null
  impatto_cliente?: string | null
  causa_errore?: string | null
  operatore_coinvolto?: string | null
  assegnazione_colpa?: string | null
  is_draft: boolean
  auto_created_from_order?: string | null
  employee: {
    id: string
    full_name: string
    role: string
  } | null
  busta?: {
    readable_id: string
    stato_attuale: string
  } | null
  cliente?: {
    id: string
    nome: string
    cognome: string
  } | null
}

export default function ErroriPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [errors, setErrors] = useState<ErrorData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showLetteraModal, setShowLetteraModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [timeframe, setTimeframe] = useState('month')
  const [showReportDropdown, setShowReportDropdown] = useState(false)
  const [draftToEdit, setDraftToEdit] = useState<ErrorData | null>(null)
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null)

  const { profile } = useUser()
  const isAdmin = profile?.role === 'admin'

  const fetchErrors = async () => {
    setLoading(true)
    try {
      if (!isAdmin) {
        setErrors([])
        setLoading(false)
        return
      }

      const params = new URLSearchParams({ timeframe })
      const response = await fetch(`/api/error-tracking?${params}`)
      const data = await response.json()

      if (data.success) {
        const fetchedErrors: ErrorData[] = data.data || []
        setErrors(fetchedErrors)
        const draftsCount = fetchedErrors.filter(err => err.is_draft).length
        window.dispatchEvent(new CustomEvent('errorDrafts:update', { detail: { count: draftsCount } }))
      } else {
        console.error('Error fetching errors:', data.error)
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchErrors()
  }, [timeframe, isAdmin])

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa bozza di errore?')) return

    try {
      setDeletingDraftId(draftId)
      const response = await fetch(`/api/error-tracking/drafts?id=${draftId}`, {
        method: 'DELETE'
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        alert(result?.error || 'Errore durante l\'eliminazione della bozza')
        return
      }

      await fetchErrors()

      if (draftToEdit?.id === draftId) {
        setDraftToEdit(null)
        setShowAddForm(false)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('draftId')
        router.replace(params.toString() ? `/errori?${params.toString()}` : '/errori', { scroll: false })
      }
      window.dispatchEvent(new CustomEvent('errorDrafts:update', { detail: { delta: -1 } }))
    } catch (error) {
      console.error('Errore eliminazione bozza:', error)
      alert('Errore inatteso durante l\'eliminazione della bozza')
    } finally {
      setDeletingDraftId(null)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const draftIdParam = searchParams.get('draftId')
    if (!draftIdParam) return
    const targetDraft = errors.find(err => err.id === draftIdParam && err.is_draft)
    if (targetDraft && (!draftToEdit || draftToEdit.id !== targetDraft.id)) {
      setDraftToEdit(targetDraft)
      setShowAddForm(true)
    }
  }, [searchParams, errors, isAdmin, draftToEdit])

  useEffect(() => {
    if (!draftToEdit) return
    const updatedDraft = errors.find(err => err.id === draftToEdit.id)
    if (!updatedDraft) {
      setDraftToEdit(null)
      setShowAddForm(false)
      return
    }
    if (!updatedDraft.is_draft) {
      setDraftToEdit(null)
      setShowAddForm(false)
      return
    }
    if (updatedDraft !== draftToEdit) {
      setDraftToEdit(updatedDraft)
    }
  }, [errors, draftToEdit])

  const generateReport = async (reportTimeframe: string) => {
    try {
      const response = await fetch(`/api/error-tracking/report?timeframe=${reportTimeframe}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Errore generazione report')
      }

      const blob = await response.blob()

      // Nomi timeframe per il file
      const timeframeNames = {
        'week': 'settimanale',
        'month': 'mensile',
        '3month': 'trimestrale',
        '6month': 'semestrale',
        'year': 'annuale'
      }

      // Download automatico del report
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-errori-${timeframeNames[reportTimeframe as keyof typeof timeframeNames]}-${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Errore generazione report:', error)
      alert('Errore nella generazione del report')
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'critico': return 'bg-red-100 text-red-800 border-red-200'
      case 'medio': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'basso': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeDisplay = (type: string) => {
    const types = {
      'anagrafica_cliente': 'Anagrafica Cliente',
      'materiali_ordine': 'Ordini Materiali',
      'comunicazione_cliente': 'Comunicazione',
      'misurazioni_vista': 'Controllo Vista',
      'controllo_qualita': 'Controllo Qualità',
      'consegna_prodotto': 'Consegna',
      'gestione_pagamenti': 'Pagamenti',
      'voice_note_processing': 'Note Vocali',
      'busta_creation': 'Gestione Buste',
      'altro': 'Altro'
  }
  return types[type as keyof typeof types] || type
}

  const drafts = errors.filter(error => error.is_draft)
  const regularErrors = errors.filter(error => !error.is_draft)
  const sortedErrors = [...drafts, ...regularErrors]

  // Raggruppa errori per dipendente per statistiche rapide
  const errorsByEmployee = regularErrors.reduce((acc, error) => {
    const employeeName = error.employee?.full_name || 'Autore sconosciuto/a'
    if (!acc[employeeName]) {
      acc[employeeName] = {
        count: 0,
        cost: 0,
        critical: 0,
        employee_id: error.employee?.id || null,
        errors: []
      }
    }
    acc[employeeName].count++
    acc[employeeName].cost += error.cost_amount
    if (error.error_category === 'critico') acc[employeeName].critical++
    acc[employeeName].errors.push(error)
    return acc
  }, {} as Record<string, any>)
  const errorsByEmployeeForLetters = Object.fromEntries(
    Object.entries(errorsByEmployee).filter(([, data]) => Boolean((data as any).employee_id))
  ) as Record<string, any>

  const totalCost = regularErrors.reduce((sum, error) => sum + error.cost_amount, 0)
  const criticalErrors = regularErrors.filter(error => error.error_category === 'critico').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Accesso riservato</h1>
          <p className="text-sm text-gray-600 mb-4">
            La sezione Tracciamento Errori è disponibile solo per gli amministratori.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Torna al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Tracciamento Errori</h1>
                <p className="text-sm text-gray-600">Monitoraggio performance e analisi errori team</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Dropdown Report - accessibile solo in pagina admin */}
              <div className="relative">
                <button
                  onClick={() => setShowReportDropdown(!showReportDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Genera Report
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showReportDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          generateReport('week')
                          setShowReportDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        📊 Report Settimanale
                      </button>
                      <button
                        onClick={() => {
                          generateReport('month')
                          setShowReportDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        📈 Report Mensile
                      </button>
                      <button
                        onClick={() => {
                          generateReport('3month')
                          setShowReportDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        📅 Report Trimestrale
                      </button>
                      <button
                        onClick={() => {
                          generateReport('6month')
                          setShowReportDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        📆 Report Semestrale
                      </button>
                      <button
                        onClick={() => {
                          generateReport('year')
                          setShowReportDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        🗓️ Report Annuale
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottone Lettera Richiamo - Solo Admin */}
              {profile?.role === 'admin' && (
                <button
                  onClick={() => setShowLetteraModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Lettera Richiamo
                </button>
              )}

              {/* Bottone Aggiungi Errore - Manager/Admin */}
              {isAdmin && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete('draftId')
                    router.replace(params.toString() ? `/errori?${params.toString()}` : '/errori', { scroll: false })
                    setDraftToEdit(null)
                    setShowAddForm(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Registra Errore
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtro Timeframe */}
        <div className="bg-white p-4 rounded-lg shadow border mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Periodo:</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Ultima settimana</option>
              <option value="month">Ultimo mese</option>
              <option value="quarter">Ultimi 3 mesi</option>
              <option value="year">Ultimo anno</option>
            </select>
          </div>
        </div>

        {/* Statistiche Generali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Errori Totali</p>
                <p className="text-2xl font-bold text-gray-900">{errors.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Costo Totale</p>
                <p className="text-2xl font-bold text-red-600">€{totalCost.toFixed(2)}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Errori Critici</p>
                <p className="text-2xl font-bold text-red-600">{criticalErrors}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Costo Medio</p>
                <p className="text-2xl font-bold text-orange-600">
                  €{regularErrors.length > 0 ? (totalCost / regularErrors.length).toFixed(2) : '0.00'}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-1" />
            <div>
              <p className="text-sm font-semibold">Bozze da completare</p>
              <p className="text-sm mt-1">
                Sono presenti <strong>{drafts.length}</strong> errori generati automaticamente che richiedono verifica e completamento.
                Apri il dettaglio per completare la registrazione.
              </p>
            </div>
          </div>
        )}

        {/* Ranking Dipendenti */}
        <div className="bg-white rounded-lg shadow border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Performance per Dipendente</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(errorsByEmployee)
                .sort(([,a], [,b]) => b.cost - a.cost)
                .map(([employeeName, stats]) => (
                <div key={employeeName} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-gray-900">{employeeName}</h3>
                    {profile?.role === 'admin' && stats.employee_id && (
                      <button
                        onClick={() => {
                          setSelectedEmployee(stats.employee_id)
                          setShowLetteraModal(true)
                        }}
                        className="text-red-600 hover:text-red-800 text-sm p-1 rounded hover:bg-red-50"
                        title="Crea lettera richiamo"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Errori:</span>
                      <span className="font-medium">{stats.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Costo:</span>
                      <span className="font-medium text-red-600">€{stats.cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Critici:</span>
                      <span className="font-medium text-red-700">{stats.critical}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista Errori Dettagliata */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Lista Errori Dettagliata</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dipendente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo/Gravità</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Busta/Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrizione</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedErrors.map((error) => {
                  const isDraft = error.is_draft
                  const rowClass = isDraft
                    ? 'cursor-pointer bg-amber-50/70 border-l-4 border-amber-400 hover:bg-amber-100/80'
                    : 'hover:bg-gray-50'
                  return (
                    <tr
                      key={error.id}
                      className={`transition-colors ${rowClass}`}
                      role={isDraft ? 'button' : undefined}
                      onClick={() => {
                        if (!isDraft) return
                        setDraftToEdit(error)
                        setShowAddForm(true)
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('draftId', error.id)
                        router.replace(`/errori?${params.toString()}`, { scroll: false })
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(error.reported_at).toLocaleDateString('it-IT')}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {error.employee?.full_name || 'Autore sconosciuto/a'}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {error.employee?.role || 'non attribuito'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 mb-1">{getTypeDisplay(error.error_type)}</div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getCategoryColor(error.error_category)}`}>
                        {error.error_category.toUpperCase()}
                        </span>
                        {isDraft && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-200 text-amber-800">
                            Bozza
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {error.busta && (
                        <div className="text-sm">
                          <div className="font-medium text-blue-600">{error.busta.readable_id}</div>
                          {error.cliente && (
                            <div className="text-gray-500">{error.cliente.cognome} {error.cliente.nome}</div>
                          )}
                        </div>
                      )}
                      {!error.busta && error.cliente && (
                        <div className="text-sm text-gray-500">
                          {error.cliente.cognome} {error.cliente.nome}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm text-gray-900 truncate" title={error.error_description}>
                        {error.error_description}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {error.client_impacted && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Cliente impattato</span>
                        )}
                        {error.requires_reorder && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Riordino necessario</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">€{error.cost_amount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">
                        {error.cost_type === 'real' ? 'Reale' : 'Stimato'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        error.resolution_status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : error.resolution_status === 'open'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {error.resolution_status === 'open' ? 'Aperto' :
                         error.resolution_status === 'resolved' ? 'Risolto' :
                         error.resolution_status === 'in_progress' ? 'In corso' :
                         error.resolution_status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {isDraft ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteDraft(error.id)
                          }}
                          disabled={deletingDraftId === error.id}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingDraftId === error.id ? 'Eliminazione...' : 'Elimina bozza'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {errors.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nessun errore trovato per il periodo selezionato</p>
              <p className="text-sm text-gray-400 mt-2">Ottime notizie per la qualità del servizio! 🎉</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isAdmin && (
        <QuickAddErrorForm
          isOpen={showAddForm}
          onClose={() => {
            setShowAddForm(false)
            setDraftToEdit(null)
            const params = new URLSearchParams(searchParams.toString())
            params.delete('draftId')
            router.replace(params.toString() ? `/errori?${params.toString()}` : '/errori', { scroll: false })
          }}
          onSuccess={() => {
            fetchErrors()
            setShowAddForm(false)
            setDraftToEdit(null)
            const params = new URLSearchParams(searchParams.toString())
            params.delete('draftId')
            router.replace(params.toString() ? `/errori?${params.toString()}` : '/errori', { scroll: false })
          }}
          prefilledBustaId={draftToEdit?.busta_id || undefined}
          prefilledEmployeeId={draftToEdit?.employee?.id || undefined}
          prefilledClienteId={draftToEdit?.cliente?.id}
          draftId={draftToEdit?.id ?? null}
          draftData={draftToEdit ? {
            id: draftToEdit.id,
            busta_id: draftToEdit.busta_id,
            employee_id: draftToEdit.employee?.id ?? null,
            cliente_id: draftToEdit.cliente?.id ?? null,
            error_type: draftToEdit.error_type,
            error_category: draftToEdit.error_category,
            error_description: draftToEdit.error_description,
            cost_type: draftToEdit.cost_type,
            cost_amount: draftToEdit.cost_amount,
            cost_detail: draftToEdit.cost_detail,
            time_lost_minutes: draftToEdit.time_lost_minutes,
            client_impacted: draftToEdit.client_impacted,
            requires_reorder: draftToEdit.requires_reorder,
            step_workflow: draftToEdit.step_workflow ?? '',
            intercettato_da: draftToEdit.intercettato_da ?? '',
            procedura_flag: draftToEdit.procedura_flag ?? '',
            impatto_cliente: draftToEdit.impatto_cliente ?? '',
            causa_errore: draftToEdit.causa_errore ?? '',
            operatore_coinvolto: draftToEdit.operatore_coinvolto ?? '',
            busta_label: draftToEdit.busta?.readable_id ?? null,
            cliente_label: draftToEdit.cliente ? `${draftToEdit.cliente.cognome} ${draftToEdit.cliente.nome}` : null
          } : null}
        />
      )}

      {profile?.role === 'admin' && (
        <LetteraRichiamoModal
          isOpen={showLetteraModal}
          onClose={() => {
            setShowLetteraModal(false)
            setSelectedEmployee('')
          }}
          preselectedEmployeeId={selectedEmployee}
          errorsByEmployee={errorsByEmployeeForLetters}
        />
      )}
    </div>
  )
}
