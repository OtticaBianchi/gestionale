'use client'

import { FollowUpCall, CallUpdateData } from '../_types'
import { CallItem } from './CallItem'
import { CategoriaBreakdown } from './CategoriaBreakdown'

interface CallListProps {
  calls: FollowUpCall[]
  isLoading: boolean
  showArchiveEmptyMessage?: boolean
  onUpdateCall: (callId: string, updateData: CallUpdateData) => Promise<void>
}

export function CallList({ calls, isLoading, showArchiveEmptyMessage, onUpdateCall }: CallListProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Caricamento chiamate...</p>
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">📞</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nessuna chiamata in programma
        </h3>
        <p className="text-gray-500">
          Clicca su "Genera Lista Follow-up" per creare una nuova lista di chiamate
        </p>
        {showArchiveEmptyMessage ? (
          <p className="text-gray-500 mt-2">
            Nessuna busta archiviata da più di 11 giorni
          </p>
        ) : null}
      </div>
    )
  }

  // Raggruppa per priorità
  const groupedCalls = {
    alta: calls.filter(call => call.priorita === 'alta'),
    normale: calls.filter(call => call.priorita === 'normale'),
    bassa: calls.filter(call => call.priorita === 'bassa')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header con contatori */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Lista Chiamate ({calls.length})
        </h2>
        <div className="flex space-x-4 text-sm">
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
            Alta: {groupedCalls.alta.length}
          </span>
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Normale: {groupedCalls.normale.length}
          </span>
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
            Bassa: {groupedCalls.bassa.length}
          </span>
        </div>
      </div>

      {/* FU2.0: Customer Categorization Breakdown */}
      <CategoriaBreakdown calls={calls} />

      {/* Lista chiamate per priorità */}
      {Object.entries(groupedCalls).map(([priorita, priorityCalls]) => {
        if (priorityCalls.length === 0) return null

        const priorityColors = {
          alta: 'border-l-red-400 bg-red-50',
          normale: 'border-l-yellow-400 bg-yellow-50',
          bassa: 'border-l-green-400 bg-green-50'
        }

        return (
          <div key={priorita} className={`border-l-4 ${priorityColors[priorita as keyof typeof priorityColors]} rounded-r-lg`}>
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3 capitalize flex items-center">
                {priorita === 'alta' && '🔴'}
                {priorita === 'normale' && '🟡'}
                {priorita === 'bassa' && '🟢'}
                <span className="ml-2">Priorità {priorita} ({priorityCalls.length})</span>
              </h3>

              <div className="space-y-3">
                {priorityCalls.map(call => (
                  <CallItem
                    key={call.id}
                    call={call}
                    onUpdate={onUpdateCall}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
