'use client'

import { useState } from 'react'
import {
  FollowUpCall,
  CallUpdateData,
  CallStatus,
  SatisfactionLevel,
  CALL_STATUS_LABELS,
  SATISFACTION_LABELS
} from '../_types'

interface CallItemProps {
  call: FollowUpCall
  onUpdate: (callId: string, updateData: CallUpdateData) => Promise<void>
}

export function CallItem({ call, onUpdate }: CallItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [formData, setFormData] = useState({
    stato_chiamata: call.stato_chiamata,
    livello_soddisfazione: call.livello_soddisfazione || '',
    note_chiamata: call.note_chiamata || '',
    orario_richiamata_da: call.orario_richiamata_da || '',
    orario_richiamata_a: call.orario_richiamata_a || ''
  })

  const handleUpdate = async () => {
    try {
      setIsUpdating(true)

      const updateData: CallUpdateData = {
        stato_chiamata: formData.stato_chiamata as CallStatus,
        note_chiamata: formData.note_chiamata || undefined,
      }

      // Aggiungi campi condizionali
      if (formData.livello_soddisfazione) {
        updateData.livello_soddisfazione = formData.livello_soddisfazione as SatisfactionLevel
      }

      if (formData.stato_chiamata === 'richiamami') {
        updateData.orario_richiamata_da = formData.orario_richiamata_da || undefined
        updateData.orario_richiamata_a = formData.orario_richiamata_a || undefined
      }

      await onUpdate(call.id, updateData)
      setShowDetails(false)
    } catch (error) {
      console.error('Errore aggiornamento:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: CallStatus) => {
    const colors = {
      da_chiamare: 'bg-blue-100 text-blue-800',
      chiamato_completato: 'bg-green-100 text-green-800',
      non_vuole_essere_contattato: 'bg-gray-100 text-gray-800',
      non_risponde: 'bg-orange-100 text-orange-800',
      cellulare_staccato: 'bg-red-100 text-red-800',
      numero_sbagliato: 'bg-red-100 text-red-800',
      richiamami: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getSatisfactionColor = (satisfaction: SatisfactionLevel) => {
    const colors = {
      molto_soddisfatto: 'text-green-600',
      soddisfatto: 'text-green-500',
      poco_soddisfatto: 'text-orange-500',
      insoddisfatto: 'text-red-500'
    }
    return colors[satisfaction]
  }

  const isCompleted = [
    'chiamato_completato',
    'non_vuole_essere_contattato',
    'numero_sbagliato',
    'cellulare_staccato'
  ].includes(call.stato_chiamata)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header chiamata */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-medium text-gray-900">
              {call.cliente_nome} {call.cliente_cognome}
            </h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.stato_chiamata)}`}>
              {CALL_STATUS_LABELS[call.stato_chiamata]}
            </span>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div>📞 {call.cliente_telefono}</div>
            <div>🛍️ {call.tipo_acquisto} - €{call.prezzo_finale}</div>
            <div>📋 Busta: {call.readable_id}</div>
            <div>📅 {call.giorni_trascorsi} giorni fa</div>
            {call.livello_soddisfazione && (
              <div className={`font-medium ${getSatisfactionColor(call.livello_soddisfazione)}`}>
                😊 {SATISFACTION_LABELS[call.livello_soddisfazione]}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {call.stato_chiamata === 'richiamami' && (
            <span className="text-xs text-orange-600 font-medium">
              {call.orario_richiamata_da && call.orario_richiamata_a
                ? `${call.orario_richiamata_da}-${call.orario_richiamata_a}`
                : 'Richiamami'
              }
            </span>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`px-3 py-1 text-xs font-medium rounded ${
              isCompleted
                ? 'bg-gray-100 text-gray-600'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {isCompleted ? '✓ Completato' : 'Gestisci'}
          </button>
        </div>
      </div>

      {/* Form di aggiornamento */}
      {showDetails && !isCompleted && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-4">
            {/* Stato chiamata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stato Chiamata
              </label>
              <select
                value={formData.stato_chiamata}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  stato_chiamata: e.target.value as CallStatus
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Object.entries(CALL_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Livello soddisfazione (solo se chiamato completato) */}
            {formData.stato_chiamata === 'chiamato_completato' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Livello di Soddisfazione
                </label>
                <select
                  value={formData.livello_soddisfazione}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    livello_soddisfazione: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleziona...</option>
                  {Object.entries(SATISFACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Orari richiamata (solo se richiamami) */}
            {formData.stato_chiamata === 'richiamami' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dalle
                  </label>
                  <input
                    type="time"
                    value={formData.orario_richiamata_da}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      orario_richiamata_da: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alle
                  </label>
                  <input
                    type="time"
                    value={formData.orario_richiamata_a}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      orario_richiamata_a: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                value={formData.note_chiamata}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  note_chiamata: e.target.value
                }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Aggiungi note sulla chiamata..."
              />
            </div>

            {/* Azioni */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Annulla
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating || (formData.stato_chiamata === 'chiamato_completato' && !formData.livello_soddisfazione)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Salvando...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note esistenti (se presenti) */}
      {call.note_chiamata && (
        <div className="mt-3 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-gray-700">
            <strong>Note:</strong> {call.note_chiamata}
          </p>
        </div>
      )}
    </div>
  )
}