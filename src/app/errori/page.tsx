'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Plus, FileText, Download, Eye, Filter, ChevronDown, ArrowLeft } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import QuickAddErrorForm from '@/components/error-tracking/QuickAddErrorForm'
import LetteraRichiamoModal from '@/components/error-tracking/LetteraRichiamoModal'
import Link from 'next/link'

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
  employee: {
    id: string
    full_name: string
    role: string
  }
  busta?: {
    readable_id: string
    stato_attuale: string
  } | null
  cliente?: {
    nome: string
    cognome: string
  } | null
}

export default function ErroriPage() {
  const [errors, setErrors] = useState<ErrorData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showLetteraModal, setShowLetteraModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [timeframe, setTimeframe] = useState('month')
  const [showReportDropdown, setShowReportDropdown] = useState(false)

  const { profile } = useUser()
  const isAdmin = profile?.role === 'admin'
  const canWrite = isAdmin || profile?.role === 'manager' // Manager possono anche inserire errori

  const fetchErrors = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ timeframe })
      const response = await fetch(`/api/error-tracking?${params}`)
      const data = await response.json()

      if (data.success) {
        setErrors(data.data || [])
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
  }, [timeframe])

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

  // Raggruppa errori per dipendente per statistiche rapide
  const errorsByEmployee = errors.reduce((acc, error) => {
    const employeeName = error.employee.full_name
    if (!acc[employeeName]) {
      acc[employeeName] = {
        count: 0,
        cost: 0,
        critical: 0,
        employee_id: error.employee.id,
        errors: []
      }
    }
    acc[employeeName].count++
    acc[employeeName].cost += error.cost_amount
    if (error.error_category === 'critico') acc[employeeName].critical++
    acc[employeeName].errors.push(error)
    return acc
  }, {} as Record<string, any>)

  const totalCost = errors.reduce((sum, error) => sum + error.cost_amount, 0)
  const criticalErrors = errors.filter(error => error.error_category === 'critico').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
              {/* Dropdown Report - Tutti possono generare */}
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
              {canWrite && (
                <button
                  onClick={() => setShowAddForm(true)}
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
                  €{errors.length > 0 ? (totalCost / errors.length).toFixed(2) : '0.00'}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

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
                    {profile?.role === 'admin' && (
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {errors.map((error) => (
                  <tr key={error.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(error.reported_at).toLocaleDateString('it-IT')}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{error.employee.full_name}</div>
                      <div className="text-sm text-gray-500 capitalize">{error.employee.role}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 mb-1">{getTypeDisplay(error.error_type)}</div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getCategoryColor(error.error_category)}`}>
                        {error.error_category.toUpperCase()}
                      </span>
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
                  </tr>
                ))}
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
      {canWrite && (
        <QuickAddErrorForm
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            fetchErrors()
            setShowAddForm(false)
          }}
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
          errorsByEmployee={errorsByEmployee}
        />
      )}
    </div>
  )
}