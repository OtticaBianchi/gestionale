'use client'

import { useState } from 'react'
import {
  FollowUpCall,
  CallUpdateData,
  CallStatus,
  SatisfactionLevel,
  CALL_STATUS_LABELS,
  SATISFACTION_LABELS,
  COMPLETED_CALL_STATES,
  ORIGIN_LABELS
} from '../_types'
import {
  getCategoriaClienteLabel,
  getCategoriaClienteColor,
  getCategoriaClienteIcon,
  type CategoriaCliente
} from '@/lib/fu2/categorizeCustomer'
import { CreateErrorModal } from './CreateErrorModal'

interface CallItemProps {
  call: FollowUpCall
  onUpdate: (callId: string, updateData: CallUpdateData) => Promise<void>
}

export function CallItem({ call, onUpdate }: CallItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showConfirmAmbassador, setShowConfirmAmbassador] = useState(false)
  const [formData, setFormData] = useState({
    stato_chiamata: call.stato_chiamata,
    livello_soddisfazione: call.livello_soddisfazione || '',
    note_chiamata: call.note_chiamata || '',
    orario_richiamata_da: call.orario_richiamata_da || '',
    orario_richiamata_a: call.orario_richiamata_a || '',
    potenziale_ambassador: call.potenziale_ambassador || false,
    motivo_ambassador: call.motivo_ambassador || '',
    problema_risolto: call.problema_risolto || false,
    richiesta_recensione_google: call.richiesta_recensione_google || false,
    link_recensione_inviato: call.link_recensione_inviato || false
  })

  const handleUpdate = async () => {
    // If ambassador is checked but no motivo, block
    if (formData.potenziale_ambassador && !formData.motivo_ambassador.trim()) {
      alert('Inserisci il motivo per la nomina ambassador.')
      return
    }

    // If ambassador is newly checked, show confirmation modal first
    if (formData.potenziale_ambassador && !call.potenziale_ambassador && !showConfirmAmbassador) {
      setShowConfirmAmbassador(true)
      return
    }

    try {
      setIsUpdating(true)
      setShowConfirmAmbassador(false)

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

      // Ambassador & Recensioni fields
      if (formData.stato_chiamata === 'chiamato_completato') {
        updateData.potenziale_ambassador = formData.potenziale_ambassador
        if (formData.potenziale_ambassador) {
          updateData.motivo_ambassador = formData.motivo_ambassador || undefined
          updateData.problema_risolto = formData.problema_risolto
        }
        updateData.richiesta_recensione_google = formData.richiesta_recensione_google
        if (formData.richiesta_recensione_google) {
          updateData.link_recensione_inviato = formData.link_recensione_inviato
        }
      }

      await onUpdate(call.id, updateData)

      // Gli stati completati faranno sparire l'intera card dalla lista,
      // quindi non serve chiudere il form manualmente
      if (COMPLETED_CALL_STATES.includes(formData.stato_chiamata)) {
        console.log(`✅ Chiamata completata per ${call.cliente_nome} ${call.cliente_cognome}`)
      } else {
        setShowDetails(false)
      }
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
      cellulare_staccato: 'bg-gray-100 text-gray-800',
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

  const isCompleted = COMPLETED_CALL_STATES.includes(call.stato_chiamata)

  // FU2.0: Show "Create Error" button if customer is dissatisfied (poco_soddisfatto or insoddisfatto)
  const isDissatisfied = call.livello_soddisfazione === 'poco_soddisfatto' || call.livello_soddisfazione === 'insoddisfatto'
  const showCreateErrorButton = isDissatisfied && call.stato_chiamata === 'chiamato_completato'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header chiamata */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
            <h4 className="font-medium text-gray-900">
              {call.cliente_nome} {call.cliente_cognome}
            </h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.stato_chiamata)}`}>
              {CALL_STATUS_LABELS[call.stato_chiamata]}
            </span>
            {call.origine && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                call.origine === 'tecnico' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {ORIGIN_LABELS[call.origine]}
              </span>
            )}
            {call.categoria_cliente && (
              <span className={`px-2 py-1 rounded-md text-xs font-medium ring-1 ${getCategoriaClienteColor(call.categoria_cliente as CategoriaCliente)}`}>
                {getCategoriaClienteIcon(call.categoria_cliente as CategoriaCliente)} {getCategoriaClienteLabel(call.categoria_cliente as CategoriaCliente)}
              </span>
            )}
            {call.potenziale_ambassador && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Ambassador
              </span>
            )}
            {call.richiesta_recensione_google && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                call.link_recensione_inviato
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {call.link_recensione_inviato ? 'Recensione Inviata' : 'Recensione Richiesta'}
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div>📞 {call.cliente_telefono}</div>
            <div>🛍️ {call.tipo_acquisto} - €{call.prezzo_finale}</div>
            {call.descrizione_prodotti && (
              <div>🔍 {call.descrizione_prodotti}</div>
            )}
            <div>📋 Busta: {call.readable_id}</div>
            <div>📅 {call.giorni_trascorsi} giorni fa</div>
            {call.scheduled_at && (
              <div>🗓️ Pianificato: {new Date(call.scheduled_at).toLocaleString('it-IT')}</div>
            )}
            {call.motivo_urgenza && (
              <div className="text-red-700">
                ⚠️ {call.motivo_urgenza}
              </div>
            )}
            {call.livello_soddisfazione && (
              <div className="flex items-center gap-2">
                <div className={`font-medium ${getSatisfactionColor(call.livello_soddisfazione)}`}>
                  😊 {SATISFACTION_LABELS[call.livello_soddisfazione]}
                </div>
                {showCreateErrorButton && (
                  <button
                    onClick={() => setShowErrorModal(true)}
                    className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    ⚠️ Registra Errore
                  </button>
                )}
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
              <label htmlFor="stato-chiamata" className="block text-sm font-medium text-gray-700 mb-1">
                Stato Chiamata
              </label>
              <select
                id="stato-chiamata"
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
                <label htmlFor="livello-soddisfazione" className="block text-sm font-medium text-gray-700 mb-1">
                  Livello di Soddisfazione
                </label>
                <select
                  id="livello-soddisfazione"
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
                  <label htmlFor="orario-dalle" className="block text-sm font-medium text-gray-700 mb-1">
                    Dalle
                  </label>
                  <input
                    id="orario-dalle"
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
                  <label htmlFor="orario-alle" className="block text-sm font-medium text-gray-700 mb-1">
                    Alle
                  </label>
                  <input
                    id="orario-alle"
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
              <label htmlFor="note-chiamata" className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                id="note-chiamata"
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

            {/* Ambassador & Recensioni (solo se chiamato_completato + molto_soddisfatto) */}
            {formData.stato_chiamata === 'chiamato_completato' && formData.livello_soddisfazione === 'molto_soddisfatto' && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                <h5 className="text-sm font-semibold text-purple-800">Ambassador & Recensioni</h5>

                {/* Potenziale Ambassador */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.potenziale_ambassador}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      potenziale_ambassador: e.target.checked,
                      ...(!e.target.checked && { motivo_ambassador: '', problema_risolto: false })
                    }))}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Potenziale Ambassador</span>
                    <p className="text-xs text-gray-500">Il cliente mostra entusiasmo spontaneo e potrebbe promuovere il negozio</p>
                  </div>
                </label>

                {/* Motivo Ambassador (solo se checkbox attiva) */}
                {formData.potenziale_ambassador && (
                  <div className="ml-6 space-y-2">
                    <div>
                      <label htmlFor="motivo-ambassador" className="block text-xs font-medium text-gray-700 mb-1">
                        Motivo nomina *
                      </label>
                      <textarea
                        id="motivo-ambassador"
                        value={formData.motivo_ambassador}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          motivo_ambassador: e.target.value
                        }))}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Es: Entusiasmo spontaneo per la montatura, problema risolto velocemente..."
                        required
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.problema_risolto}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          problema_risolto: e.target.checked
                        }))}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Problema risolto durante il follow-up</span>
                    </label>
                  </div>
                )}

                <hr className="border-purple-200" />

                {/* Recensione Google */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.richiesta_recensione_google}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      richiesta_recensione_google: e.target.checked,
                      ...(!e.target.checked && { link_recensione_inviato: false })
                    }))}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Richiesta Recensione Google</span>
                    <p className="text-xs text-gray-500">Ho chiesto al cliente di lasciare una recensione su Google</p>
                  </div>
                </label>

                {/* Link inviato (solo se recensione richiesta) */}
                {formData.richiesta_recensione_google && (
                  <label className="flex items-center gap-2 ml-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.link_recensione_inviato}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        link_recensione_inviato: e.target.checked
                      }))}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Link recensione inviato via WhatsApp/SMS</span>
                  </label>
                )}
              </div>
            )}

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
                disabled={isUpdating || (formData.stato_chiamata === 'chiamato_completato' && !formData.livello_soddisfazione) || (formData.potenziale_ambassador && !formData.motivo_ambassador.trim())}
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

      {/* Ambassador detail box (for completed calls with ambassador data) */}
      {call.potenziale_ambassador && call.motivo_ambassador && (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <p className="text-sm text-purple-800">
            <strong>Ambassador:</strong> {call.motivo_ambassador}
          </p>
          {call.problema_risolto && (
            <p className="text-xs text-purple-600 mt-1">Problema risolto durante il follow-up</p>
          )}
        </div>
      )}

      {/* Ambassador Confirmation Modal */}
      {showConfirmAmbassador && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Conferma Nomina Ambassador</h3>
            <p className="text-sm text-gray-600 mb-4">
              Stai per nominare <strong>{call.cliente_nome} {call.cliente_cognome}</strong> come Ambassador.
              Verr&agrave; generato un codice referral univoco e il cliente sar&agrave; inserito nel programma Ambassador.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Motivo:</strong> {formData.motivo_ambassador}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmAmbassador(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Annulla
              </button>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-300"
              >
                {isUpdating ? 'Salvando...' : 'Conferma Ambassador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FU2.0: Error Creation Modal */}
      <CreateErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onSuccess={() => {
          setShowErrorModal(false)
          // Optionally refresh the call list here if needed
        }}
        callId={call.id}
        bustaId={call.busta_id}
        clienteNome={call.cliente_nome}
        clienteCognome={call.cliente_cognome}
        readableId={call.readable_id}
        livelloSoddisfazione={SATISFACTION_LABELS[call.livello_soddisfazione || 'insoddisfatto']}
      />
    </div>
  )
}
