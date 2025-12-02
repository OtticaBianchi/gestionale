'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { X, Search, AlertTriangle, DollarSign, Clock, User, FileText } from 'lucide-react'
import { Database } from '@/types/database.types'
import {
  calculateAssegnazioneColpa,
  getAssegnazioneColpaLabel,
  getAssegnazioneColpaColor,
  type StepWorkflow,
  type IntercettatoDa,
  type ProceduraFlag,
  type ImpattoCliente,
  type AssegnazioneColpa
} from '@/lib/et2/assegnazioneColpa'

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
  draftId?: string | null
  draftData?: {
    id?: string
    busta_id?: string | null
    employee_id?: string
    cliente_id?: string | null
    error_type?: string
    error_category?: 'critico' | 'medio' | 'basso' | ''
    error_description?: string
    cost_type?: 'real' | 'estimate'
    cost_amount?: number | null
    cost_detail?: string | null
    time_lost_minutes?: number | null
    client_impacted?: boolean
    requires_reorder?: boolean
    busta_label?: string | null
    cliente_label?: string | null
    // ET2.0 Fields
    step_workflow?: string
    intercettato_da?: string
    procedura_flag?: string
    impatto_cliente?: string
    operatore_coinvolto?: string
  } | null
}

export default function QuickAddErrorForm({
  isOpen,
  onClose,
  onSuccess,
  prefilledBustaId,
  prefilledEmployeeId,
  prefilledClienteId,
  draftId = null,
  draftData = null
}: QuickAddErrorFormProps) {
  const defaultFormState = {
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
    requires_reorder: false,
    // ET2.0 Fields
    step_workflow: '',
    intercettato_da: '',
    procedura_flag: '',
    impatto_cliente: '',
    operatore_coinvolto: ''
  }

  const [formData, setFormData] = useState(defaultFormState)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [buste, setBuste] = useState<Busta[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  const [searchBusta, setSearchBusta] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [assegnazioneColpa, setAssegnazioneColpa] = useState<AssegnazioneColpa | null>(null)

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

  const isDraftMode = Boolean(draftId)

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      const draftDefaults = draftData ?? null
      const computedCostType = draftDefaults?.cost_type ?? 'estimate'
      const realCostValue =
        computedCostType === 'real' && typeof draftDefaults?.cost_amount === 'number'
          ? draftDefaults.cost_amount.toFixed(2)
          : ''

      setFormData({
        busta_id: draftDefaults?.busta_id ?? prefilledBustaId ?? '',
        employee_id: draftDefaults?.employee_id ?? prefilledEmployeeId ?? '',
        cliente_id: draftDefaults?.cliente_id ?? prefilledClienteId ?? '',
        error_type: draftDefaults?.error_type ?? '',
        error_category: draftDefaults?.error_category ?? '',
        error_description: draftDefaults?.error_description ?? '',
        cost_type: computedCostType,
        custom_cost:
          computedCostType === 'real'
            ? realCostValue
            : draftDefaults?.cost_amount
            ? draftDefaults.cost_amount.toFixed(2)
            : '',
        cost_detail: draftDefaults?.cost_detail ?? '',
        time_lost_minutes: draftDefaults?.time_lost_minutes
          ? String(draftDefaults.time_lost_minutes)
          : '',
        client_impacted: draftDefaults?.client_impacted ?? false,
        requires_reorder: draftDefaults?.requires_reorder ?? false,
        // ET2.0 Fields (if they exist in draft)
        step_workflow: (draftDefaults as any)?.step_workflow ?? '',
        intercettato_da: (draftDefaults as any)?.intercettato_da ?? '',
        procedura_flag: (draftDefaults as any)?.procedura_flag ?? '',
        impatto_cliente: (draftDefaults as any)?.impatto_cliente ?? '',
        operatore_coinvolto: (draftDefaults as any)?.operatore_coinvolto ?? ''
      })
      setSearchCliente(draftDefaults?.cliente_label ?? '')
      setSearchBusta(draftDefaults?.busta_label ?? '')
      const estimate =
        computedCostType === 'estimate' && draftDefaults?.cost_amount
          ? draftDefaults.cost_amount
          : null
      setEstimatedCost(estimate)
    } else {
      setEstimatedCost(null)
    }
  }, [isOpen, prefilledBustaId, prefilledEmployeeId, prefilledClienteId, draftId, draftData])

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

  // ET2.0: Auto-calculate assegnazione_colpa when classification fields change
  useEffect(() => {
    const { step_workflow, intercettato_da, procedura_flag, impatto_cliente, operatore_coinvolto } = formData

    if (step_workflow && procedura_flag) {
      const result = calculateAssegnazioneColpa({
        step_workflow: step_workflow as StepWorkflow,
        intercettato_da: intercettato_da as IntercettatoDa,
        procedura_flag: procedura_flag as ProceduraFlag,
        impatto_cliente: impatto_cliente as ImpattoCliente,
        operatore_coinvolto: operatore_coinvolto || undefined,
        creato_da_followup: false
      })
      setAssegnazioneColpa(result)
    } else {
      setAssegnazioneColpa(null)
    }
  }, [formData.step_workflow, formData.intercettato_da, formData.procedura_flag, formData.impatto_cliente, formData.operatore_coinvolto])

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
        cost_detail: formData.cost_type === 'real' ? formData.cost_detail : formData.cost_detail || null,
        // ET2.0 Fields
        step_workflow: formData.step_workflow || undefined,
        intercettato_da: formData.intercettato_da || undefined,
        procedura_flag: formData.procedura_flag || undefined,
        impatto_cliente: formData.impatto_cliente || undefined,
        operatore_coinvolto: formData.operatore_coinvolto || undefined
        // assegnazione_colpa is calculated server-side
      }

      const endpoint = draftId ? '/api/error-tracking/drafts' : '/api/error-tracking'
      const method = draftId ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftId ? { ...payload, id: draftId } : payload)
      })

      const result = await response.json()

      if (result.success) {
        onSuccess()
        if (draftId) {
          window.dispatchEvent(new CustomEvent('errorDrafts:update', { detail: { delta: -1 } }))
        } else {
          window.dispatchEvent(new CustomEvent('errorDrafts:update'))
        }
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
            <h2 className="text-xl font-semibold text-gray-900">
              {isDraftMode ? 'Completa Bozza Errore' : 'Registra Errore'}
            </h2>
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

          {/* ET2.0: Error Classification Section */}
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              📊 Classificazione Errore (ET2.0)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Step Workflow */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fase Workflow <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.step_workflow}
                  onChange={(e) => setFormData({...formData, step_workflow: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona fase...</option>
                  <option value="accoglienza">Accoglienza</option>
                  <option value="pre_controllo">Pre-Controllo</option>
                  <option value="sala_controllo">Sala Controllo</option>
                  <option value="preventivo_vendita">Preventivo/Vendita</option>
                  <option value="ordine_materiali">Ordine Materiali</option>
                  <option value="lavorazione">Lavorazione</option>
                  <option value="controllo_qualita">Controllo Qualità</option>
                  <option value="consegna">Consegna</option>
                  <option value="post_vendita">Post-Vendita</option>
                  <option value="follow_up">Follow-Up</option>
                </select>
              </div>

              {/* Intercettato Da */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intercettato Da
                </label>
                <select
                  value={formData.intercettato_da}
                  onChange={(e) => setFormData({...formData, intercettato_da: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="cliente">Cliente</option>
                  <option value="ob_controllo_qualita">OB - Controllo Qualità</option>
                  <option value="ob_processo">OB - Durante Processo</option>
                  <option value="ob_follow_up">OB - Follow-Up</option>
                </select>
              </div>

              {/* Procedura Flag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stato Procedura <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.procedura_flag}
                  onChange={(e) => setFormData({...formData, procedura_flag: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona...</option>
                  <option value="procedura_presente">✅ Procedura Presente</option>
                  <option value="procedura_imprecisa">⚠️ Procedura Imprecisa</option>
                  <option value="procedura_assente">❌ Procedura Assente</option>
                </select>
              </div>

              {/* Impatto Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impatto Cliente
                </label>
                <select
                  value={formData.impatto_cliente}
                  onChange={(e) => setFormData({...formData, impatto_cliente: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="basso">🟢 Basso</option>
                  <option value="medio">🟡 Medio</option>
                  <option value="alto">🔴 Alto</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Lascia vuoto per calcolo automatico
                </p>
              </div>

              {/* Operatore Coinvolto - Only show if procedura_presente */}
              {formData.procedura_flag === 'procedura_presente' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operatore Specifico Coinvolto
                  </label>
                  <select
                    value={formData.operatore_coinvolto}
                    onChange={(e) => setFormData({...formData, operatore_coinvolto: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nessun operatore specifico</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || 'Nome non disponibile'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Indica l'operatore coinvolto se diverso da chi ha registrato l'errore
                  </p>
                </div>
              )}
            </div>

            {/* Assegnazione Colpa Display (Auto-calculated) */}
            {assegnazioneColpa && (
              <div className="p-3 bg-white border border-gray-300 rounded-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assegnazione Colpa (Automatica)
                </label>
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${getAssegnazioneColpaColor(assegnazioneColpa)}`}>
                  {getAssegnazioneColpaLabel(assegnazioneColpa)}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Calcolato automaticamente in base alla classificazione
                </p>
              </div>
            )}
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
              className={`px-6 py-2 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 ${isDraftMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {loading ? 'Salvataggio...' : isDraftMode ? 'Completa Bozza' : 'Registra Errore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
