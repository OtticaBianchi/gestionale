'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import {
  calculateAssegnazioneColpa,
  getAssegnazioneColpaLabel,
  getAssegnazioneColpaColor,
  type StepWorkflow,
  type IntercettatoDa,
  type ProceduraFlag,
  type ImpattoCliente,
  type CausaErrore,
  type AssegnazioneColpa
} from '@/lib/et2/assegnazioneColpa'

interface CreateErrorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  callId: string
  bustaId: string
  clienteNome: string
  clienteCognome: string
  readableId: string
  livelloSoddisfazione: string
}

export function CreateErrorModal({
  isOpen,
  onClose,
  onSuccess,
  callId,
  bustaId,
  clienteNome,
  clienteCognome,
  readableId,
  livelloSoddisfazione
}: CreateErrorModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    error_description: '',
    error_type: 'post_vendita',
    error_category: 'medio',
    // ET2.0 Fields - pre-filled for follow-up context
    step_workflow: 'follow_up', // Pre-filled since this comes from follow-up
    intercettato_da: 'ob_follow_up', // Fixed for FU2 flow
    procedura_flag: '',
    impatto_cliente: 'alto', // Pre-filled as alto since customer is dissatisfied
    causa_errore: 'non_identificabile',
    operatore_coinvolto: ''
  })
  const [assegnazioneColpa, setAssegnazioneColpa] = useState<AssegnazioneColpa | null>(null)

  // ET2.0: Auto-calculate assegnazione_colpa when classification fields change
  useEffect(() => {
    const { step_workflow, intercettato_da, procedura_flag, impatto_cliente, causa_errore, operatore_coinvolto } = formData

    if (step_workflow && procedura_flag && causa_errore) {
      const result = calculateAssegnazioneColpa({
        step_workflow: step_workflow as StepWorkflow,
        intercettato_da: intercettato_da as IntercettatoDa,
        procedura_flag: procedura_flag as ProceduraFlag,
        impatto_cliente: impatto_cliente as ImpattoCliente,
        causa_errore: causa_errore as CausaErrore,
        operatore_coinvolto: operatore_coinvolto || undefined,
        creato_da_followup: true
      })
      setAssegnazioneColpa(result)
    } else {
      setAssegnazioneColpa(null)
    }
  }, [formData.step_workflow, formData.intercettato_da, formData.procedura_flag, formData.impatto_cliente, formData.causa_errore, formData.operatore_coinvolto])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/follow-up/calls/${callId}/errore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: formData.error_type,
          error_category: formData.error_category,
          error_description: formData.error_description,
          step_workflow: formData.step_workflow,
          intercettato_da: formData.intercettato_da,
          procedura_flag: formData.procedura_flag,
          impatto_cliente: formData.impatto_cliente,
          causa_errore: formData.causa_errore,
          operatore_coinvolto: formData.operatore_coinvolto || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        onSuccess()
        onClose()
      } else {
        alert('Errore durante la creazione: ' + result.error)
      }
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore durante la creazione dell\'errore')
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
              Registra Errore da Follow-Up
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Context Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Contesto Follow-Up</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div>Cliente: <strong>{clienteCognome} {clienteNome}</strong></div>
              <div>Busta: <strong>{readableId}</strong></div>
              <div className="text-xs text-blue-700">ID interno: {bustaId}</div>
              <div>Soddisfazione: <strong className="text-red-600">{livelloSoddisfazione}</strong></div>
            </div>
          </div>

          {/* Error Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Errore <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.error_type}
                onChange={(e) => setFormData(prev => ({ ...prev, error_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="post_vendita">Post-Vendita</option>
                <option value="comunicazione_cliente">Comunicazione Cliente</option>
                <option value="controllo_qualita">Controllo Qualita</option>
                <option value="consegna_prodotto">Consegna Prodotto</option>
                <option value="altro">Altro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gravita <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.error_category}
                onChange={(e) => setFormData(prev => ({ ...prev, error_category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="basso">Basso</option>
                <option value="medio">Medio</option>
                <option value="critico">Critico</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="error-description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione del Problema Segnalato dal Cliente *
            </label>
            <textarea
              id="error-description"
              value={formData.error_description}
              onChange={(e) => setFormData(prev => ({ ...prev, error_description: e.target.value }))}
              required
              rows={4}
              placeholder="Descrivi dettagliatamente il problema segnalato dal cliente durante la chiamata di follow-up..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ET2.0: Error Classification Section */}
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              📊 Classificazione Errore (ET2.0)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Step Workflow - Fixed for FU2 flow */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fase Workflow <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.step_workflow}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="follow_up">Follow-Up</option>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  Valore fisso per errori creati da follow-up
                </p>
              </div>

              {/* Intercettato Da - Fixed for FU2 flow */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intercettato Da
                </label>
                <select
                  value={formData.intercettato_da}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ob_follow_up">OB - Follow-Up</option>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  Valore fisso per errori generati in contesto FU2
                </p>
              </div>

              {/* Procedura Flag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stato Procedura <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.procedura_flag}
                  onChange={(e) => setFormData({ ...formData, procedura_flag: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona...</option>
                  <option value="procedura_presente">✅ Procedura Presente</option>
                  <option value="procedura_imprecisa">⚠️ Procedura Imprecisa</option>
                  <option value="procedura_assente">❌ Procedura Assente</option>
                </select>
              </div>

              {/* Impatto Cliente - Pre-filled as alto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impatto Cliente
                </label>
                <select
                  value={formData.impatto_cliente}
                  onChange={(e) => setFormData({ ...formData, impatto_cliente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basso">🟢 Basso</option>
                  <option value="medio">🟡 Medio</option>
                  <option value="alto">🔴 Alto</option>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  Pre-impostato su &quot;Alto&quot; per clienti insoddisfatti
                </p>
              </div>

              {/* Causa Errore */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Causa Errore <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.causa_errore}
                  onChange={(e) => setFormData({ ...formData, causa_errore: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cliente">Cliente</option>
                  <option value="interno">Interno</option>
                  <option value="esterno">Esterno</option>
                  <option value="non_identificabile">Non identificabile</option>
                </select>
              </div>
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

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              ℹ️ Questo errore sarà automaticamente collegato alla chiamata di follow-up e alla busta del cliente.
              I campi ET2.0 principali sono pre-impostati in base al contesto FU2; puoi completare classificazione e causa.
            </p>
          </div>

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
              {loading ? 'Creazione...' : 'Crea Errore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
