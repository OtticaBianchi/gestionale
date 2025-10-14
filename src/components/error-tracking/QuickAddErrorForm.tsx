'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { X, Search, AlertTriangle, DollarSign, Clock, User, FileText } from 'lucide-react'
import { Database } from '@/types/database.types'

type Employee = {
  id: string
  full_name: string | null
  role: string
}

type Cliente = {
  id: string
  nome: string
  cognome: string
  telefono: string | null
}

type Busta = {
  id: string
  readable_id: string
  stato_attuale: string
  clienti: {
    nome: string
    cognome: string
  } | null
}

interface QuickAddErrorFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  prefilledBustaId?: string
  prefilledEmployeeId?: string
  prefilledClienteId?: string
}

export default function QuickAddErrorForm({
  isOpen,
  onClose,
  onSuccess,
  prefilledBustaId,
  prefilledEmployeeId,
  prefilledClienteId
}: QuickAddErrorFormProps) {
  const [formData, setFormData] = useState({
    busta_id: prefilledBustaId || '',
    employee_id: prefilledEmployeeId || '',
    cliente_id: prefilledClienteId || '',
    error_type: '',
    error_category: '',
    error_description: '',
    cost_type: 'estimate' as 'real' | 'estimate',
    custom_cost: '',
    cost_detail: '',
    time_lost_minutes: '',
    client_impacted: false,
    requires_reorder: false
  })

  const [employees, setEmployees] = useState<Employee[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [buste, setBuste] = useState<Busta[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  const [searchBusta, setSearchBusta] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Error types adattati al gestionale ottico
  const errorTypes = {
    'anagrafica_cliente': 'Errori Anagrafica Cliente',
    'busta_creation': 'Gestione Buste',
    'materiali_ordine': 'Ordini Materiali',
    'comunicazione_cliente': 'Comunicazione Cliente',
    'misurazioni_vista': 'Controllo Vista/Misurazioni',
    'controllo_qualita': 'Controllo Qualità',
    'consegna_prodotto': 'Consegna Prodotto',
    'gestione_pagamenti': 'Pagamenti',
    'voice_note_processing': 'Note Vocali',
    'altro': 'Altro'
  }

  const errorCategories = {
    'critico': { label: 'Critico', description: '€200-500 - Rifacimenti, clienti persi', color: 'text-red-600' },
    'medio': { label: 'Medio', description: '€50-200 - Ricontatti, ritardi', color: 'text-yellow-600' },
    'basso': { label: 'Basso', description: '€5-50 - Correzioni minori', color: 'text-green-600' }
  }

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setFormData({
        busta_id: prefilledBustaId || '',
        employee_id: prefilledEmployeeId || '',
        cliente_id: prefilledClienteId || '',
        error_type: '',
        error_category: '',
        error_description: '',
        cost_type: 'estimate',
        custom_cost: '',
        cost_detail: '',
        time_lost_minutes: '',
        client_impacted: false,
        requires_reorder: false
      })
      setSearchCliente('')
      setSearchBusta('')
      setEstimatedCost(null)
    }
  }, [isOpen, prefilledBustaId, prefilledEmployeeId, prefilledClienteId])

  // Carica dipendenti al mount
  useEffect(() => {
    if (isOpen) {
      fetchEmployees()
    }
  }, [isOpen])

  // Stima costo automatico quando cambiano tipo/categoria
  useEffect(() => {
    if (formData.error_type && formData.error_category && formData.cost_type === 'estimate') {
      estimateCost()
    } else {
      setEstimatedCost(null)
    }
  }, [formData.error_type, formData.error_category, formData.cost_type])

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    if (data) {
      const normalized = data
        .filter((employee): employee is Employee => Boolean(employee.full_name && employee.id))
        .map((employee) => ({
          ...employee,
          full_name: employee.full_name?.trim() || employee.full_name,
          role: employee.role || 'Non assegnato'
        }))

      const uniqueEmployees = Array.from(new Map(normalized.map(emp => [emp.id, emp])).values())

      setEmployees(uniqueEmployees)
    }
  }

  const searchClienti = async (query: string) => {
    if (query.length < 2) {
      setClienti([])
      return
    }

    const { data } = await supabase
      .from('clienti')
      .select('id, nome, cognome, telefono')
      .or(`nome.ilike.%${query}%,cognome.ilike.%${query}%,telefono.ilike.%${query}%`)
      .limit(10)

    if (data) setClienti(data)
  }

  const searchBuste = async (query: string) => {
    if (query.length < 2) {
      setBuste([])
      return
    }

    const { data } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        stato_attuale,
        clienti(nome, cognome)
      `)
      .or(`readable_id.ilike.%${query}%,id.ilike.%${query}%`)
      .order('data_apertura', { ascending: false })
      .limit(10)

    if (data) setBuste(data as any)
  }

  const estimateCost = async () => {
    try {
      const { data } = await supabase
        .from('error_cost_defaults' as any)
        .select('default_cost')
        .eq('error_type', formData.error_type)
        .eq('error_category', formData.error_category)
        .eq('is_active', true)
        .single()

      if (data) {
        setEstimatedCost((data as any).default_cost)
      }
    } catch (error) {
      console.error('Error estimating cost:', error)
      // Fallback to default costs if table doesn't exist
      const defaultCosts = {
        'procedura': { 'lieve': 5, 'moderato': 15, 'critico': 30 },
        'materiale': { 'lieve': 10, 'moderato': 25, 'critico': 50 },
        'comunicazione': { 'lieve': 8, 'moderato': 20, 'critico': 40 }
      }
      const cost = (defaultCosts as any)[formData.error_type]?.[formData.error_category] || 10
      setEstimatedCost(cost)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        custom_cost: formData.custom_cost ? Number.parseFloat(formData.custom_cost) : undefined,
        time_lost_minutes: Number.parseInt(formData.time_lost_minutes) || 0,
        cost_detail: formData.cost_type === 'real' ? formData.cost_detail : null
      }

      const response = await fetch('/api/error-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        onSuccess()
      } else {
        alert('Errore durante il salvataggio: ' + result.error)
      }
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Registra Errore</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dipendente che ha fatto l'errore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Dipendente che ha commesso l'errore *
            </label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData(prev => ({...prev, employee_id: e.target.value}))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleziona dipendente...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name || 'Nome non disponibile'} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo e categoria errore */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="error-type" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Errore *
              </label>
              <select
                id="error-type"
                value={formData.error_type}
                onChange={(e) => setFormData(prev => ({...prev, error_type: e.target.value}))}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona tipo...</option>
                {Object.entries(errorTypes).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="error-category" className="block text-sm font-medium text-gray-700 mb-2">
                Gravità *
              </label>
              <select
                id="error-category"
                value={formData.error_category}
                onChange={(e) => setFormData(prev => ({...prev, error_category: e.target.value}))}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleziona gravità...</option>
                {Object.entries(errorCategories).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label} - {info.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrizione errore */}
          <div>
            <label htmlFor="error-description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione Errore *
            </label>
            <textarea
              id="error-description"
              value={formData.error_description}
              onChange={(e) => setFormData(prev => ({...prev, error_description: e.target.value}))}
              required
              rows={3}
              placeholder="Descrivi dettagliatamente l'errore commesso..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Tipo di costo */}
          <div>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Tipo di Costo
              </legend>
              <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="estimate"
                  checked={formData.cost_type === 'estimate'}
                  onChange={(e) => setFormData(prev => ({...prev, cost_type: e.target.value as 'estimate'}))}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Costo Stimato</div>
                  <div className="text-sm text-gray-500">Calcolo automatico</div>
                </div>
              </label>
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="real"
                  checked={formData.cost_type === 'real'}
                  onChange={(e) => setFormData(prev => ({...prev, cost_type: e.target.value as 'real'}))}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Costo Reale</div>
                  <div className="text-sm text-gray-500">Importo effettivo</div>
                </div>
              </label>
              </div>
            </fieldset>
          </div>

          {/* Campi costo basati sul tipo */}
          {formData.cost_type === 'real' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="custom-cost" className="block text-sm font-medium text-gray-700 mb-2">
                  Costo Effettivo (€) *
                </label>
                <input
                  id="custom-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.custom_cost}
                  onChange={(e) => setFormData(prev => ({...prev, custom_cost: e.target.value}))}
                  required={formData.cost_type === 'real'}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="cost-detail" className="block text-sm font-medium text-gray-700 mb-2">
                  Dettaglio Costo *
                </label>
                <input
                  id="cost-detail"
                  type="text"
                  value={formData.cost_detail}
                  onChange={(e) => setFormData(prev => ({...prev, cost_detail: e.target.value}))}
                  required={formData.cost_type === 'real'}
                  placeholder="es. Lenti riordinate €450 + spedizione €25"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {formData.cost_type === 'estimate' && (
            <div>
              <label htmlFor="override-estimate" className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Sovrascrivi Stima Automatica (Opzionale)
              </label>
              <input
                id="override-estimate"
                type="number"
                step="0.01"
                min="0"
                value={formData.custom_cost}
                onChange={(e) => setFormData(prev => ({...prev, custom_cost: e.target.value}))}
                placeholder={estimatedCost ? `Stima automatica: €${estimatedCost.toFixed(2)}` : 'Lascia vuoto per stima automatica'}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                {formData.custom_cost ?
                  '💰 Verrà usato il costo personalizzato inserito' :
                  estimatedCost ?
                    `🤖 Verrà usata la stima automatica di €${estimatedCost.toFixed(2)}` :
                    '⏳ Seleziona tipo e categoria errore per vedere la stima automatica'
                }
              </p>
            </div>
          )}

          {/* Ricerca Cliente */}
          <div>
            <label htmlFor="search-cliente" className="block text-sm font-medium text-gray-700 mb-2">
              Cliente Coinvolto (opzionale)
            </label>
            <div className="relative">
              <input
                id="search-cliente"
                type="text"
                value={searchCliente}
                onChange={(e) => {
                  setSearchCliente(e.target.value)
                  searchClienti(e.target.value)
                }}
                placeholder="Cerca per nome, cognome o telefono..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
            </div>
            {clienti.length > 0 && searchCliente && (
              <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-sm max-h-32 overflow-y-auto">
                {clienti.map(cliente => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({...prev, cliente_id: cliente.id}))
                      setSearchCliente(`${cliente.cognome} ${cliente.nome}`)
                      setClienti([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{cliente.cognome} {cliente.nome}</div>
                    {cliente.telefono && (
                      <div className="text-sm text-gray-500">{cliente.telefono}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ricerca Busta */}
          <div>
            <label htmlFor="search-busta" className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Busta Coinvolta (opzionale)
            </label>
            <div className="relative">
              <input
                id="search-busta"
                type="text"
                value={searchBusta}
                onChange={(e) => {
                  setSearchBusta(e.target.value)
                  searchBuste(e.target.value)
                }}
                placeholder="Cerca per numero busta (es. 2025-001)..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
            </div>
            {buste.length > 0 && searchBusta && (
              <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-sm max-h-32 overflow-y-auto">
                {buste.map(busta => (
                  <button
                    key={busta.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({...prev, busta_id: busta.id}))
                      setSearchBusta(busta.readable_id)
                      setBuste([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{busta.readable_id}</div>
                    <div className="text-sm text-gray-500">
                      {busta.clienti?.cognome} {busta.clienti?.nome} - {busta.stato_attuale}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tempo perso */}
          <div>
            <label htmlFor="time-lost" className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Tempo Perso (minuti)
            </label>
            <input
              id="time-lost"
              type="number"
              value={formData.time_lost_minutes}
              onChange={(e) => setFormData(prev => ({...prev, time_lost_minutes: e.target.value}))}
              min="0"
              placeholder="0"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Checkboxes impatto */}
          <div className="space-y-3">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.client_impacted}
                onChange={(e) => setFormData(prev => ({...prev, client_impacted: e.target.checked}))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <span className="ml-3 text-sm text-gray-700">
                <span className="font-medium">Il cliente è stato impattato</span>
                <div className="text-gray-500">Cliente ha dovuto tornare, ricontatti necessari, etc.</div>
              </span>
            </label>

            <label className="flex items-start">
              <input
                type="checkbox"
                checked={formData.requires_reorder}
                onChange={(e) => setFormData(prev => ({...prev, requires_reorder: e.target.checked}))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <span className="ml-3 text-sm text-gray-700">
                <span className="font-medium">È necessario riordinare materiali</span>
                <div className="text-gray-500">Lenti, montature o altri prodotti da riordinare</div>
              </span>
            </label>
          </div>

          {/* Riepilogo costo finale */}
          {(estimatedCost || formData.custom_cost) && formData.cost_type === 'estimate' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">
                  Costo finale: €{formData.custom_cost ? Number.parseFloat(formData.custom_cost).toFixed(2) : estimatedCost?.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                {formData.custom_cost ?
                  '✅ Costo personalizzato - Verrà registrato come "stimato" ma con valore specifico' :
                  '🤖 Stima automatica basata su tipo errore e categoria - Puoi sovrasscrivere sopra se necessario'
                }
              </p>
            </div>
          )}

          {formData.cost_type === 'real' && formData.custom_cost && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">
                  Costo reale: €{Number.parseFloat(formData.custom_cost).toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                💯 Costo effettivo - Verrà registrato come "reale" con dettaglio obbligatorio
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {loading ? 'Salvataggio...' : 'Registra Errore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
