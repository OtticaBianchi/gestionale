'use client'

import { AlertBusta, BriefingTask } from '@/types/briefing'

interface AssignableProfile {
  id: string
  full_name: string
  role: string
}

interface BriefingRowProps {
  item: AlertBusta | BriefingTask
  assignableProfiles: AssignableProfile[]
  onAssign: (bustaId: string, profileId: string | null) => void
  onNota: (bustaId: string, nota: string) => void
  onRemove?: (bustaId: string) => void
  showRemove?: boolean
  // For task mode (existing snapshot)
  taskId?: string
  onToggleRisolto?: (taskId: string, value: boolean) => void
  risolto?: boolean
  readOnly?: boolean
}

function isAlertBusta(item: AlertBusta | BriefingTask): item is AlertBusta {
  return 'cliente_nome' in item
}

function getStatoBadgeColor(stato: string) {
  switch (stato) {
    case 'nuove': return 'bg-blue-100 text-blue-800'
    case 'materiali_ordinati': return 'bg-yellow-100 text-yellow-800'
    case 'materiali_arrivati': return 'bg-orange-100 text-orange-800'
    case 'in_lavorazione': return 'bg-purple-100 text-purple-800'
    case 'pronto_ritiro': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getPrioritaColor(priorita: string) {
  switch (priorita) {
    case 'critica': return 'text-red-600 font-bold'
    case 'urgente': return 'text-orange-600 font-semibold'
    default: return 'text-gray-500'
  }
}

export default function BriefingRow({
  item,
  assignableProfiles,
  onAssign,
  onNota,
  onRemove,
  showRemove,
  taskId,
  onToggleRisolto,
  risolto,
  readOnly = false,
}: BriefingRowProps) {
  const isAlert = isAlertBusta(item)

  const bustaId = isAlert ? item.busta_id : item.busta_id
  const readableId = isAlert ? item.readable_id : item.busta?.readable_id ?? ''
  const tipoLavorazione = isAlert ? item.tipo_lavorazione : item.busta?.tipo_lavorazione ?? ''
  const statoAttuale = isAlert ? item.stato_attuale : item.busta?.stato_attuale ?? ''
  const priorita = isAlert ? item.priorita : item.busta?.priorita ?? ''
  const motivo = item.motivo
  const clienteNome = isAlert ? item.cliente_nome : item.busta?.clienti?.nome ?? ''
  const clienteCognome = isAlert ? item.cliente_cognome : item.busta?.clienti?.cognome ?? ''

  const assignedId = isAlert ? null : item.assegnato_a
  const notaAdmin = isAlert ? '' : (item.nota_admin ?? '')

  return (
    <div className={`border rounded-lg p-3 bg-white shadow-sm ${risolto ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatoBadgeColor(statoAttuale)}`}>
              {statoAttuale.replace('_', ' ')}
            </span>
            <span className="font-mono text-sm font-semibold text-gray-800">{readableId}</span>
            <span className="text-sm text-gray-700">— {clienteCognome} {clienteNome}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{tipoLavorazione}</span>
            {priorita !== 'normale' && (
              <span className={`text-xs ${getPrioritaColor(priorita)}`}>[{priorita.toUpperCase()}]</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{motivo}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {taskId && onToggleRisolto && (
            <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                checked={risolto ?? false}
                onChange={e => onToggleRisolto(taskId, e.target.checked)}
                className="rounded"
              />
              Risolto
            </label>
          )}
          {showRemove && onRemove && !readOnly && (
            <button
              onClick={() => onRemove(bustaId)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
              title="Rimuovi"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <select
            value={assignedId ?? ''}
            onChange={e => onAssign(bustaId, e.target.value || null)}
            className="text-xs border rounded px-2 py-1 bg-white text-gray-700 flex-1 min-w-[140px]"
          >
            <option value="">— Assegna a...</option>
            {assignableProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <input
            type="text"
            maxLength={150}
            placeholder="Istruzione (max 150 car.)..."
            defaultValue={notaAdmin}
            onBlur={e => onNota(bustaId, e.target.value)}
            className="text-xs border rounded px-2 py-1 flex-[2] min-w-[180px] text-gray-700"
          />
        </div>
      )}

      {readOnly && (
        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
          {assignedId && (
            <p>Assegnato a: <span className="font-medium text-gray-700">
              {(item as BriefingTask).assegnato_a_profile?.full_name ?? assignedId}
            </span></p>
          )}
          {notaAdmin && <p>Istruzione: <span className="italic">{notaAdmin}</span></p>}
        </div>
      )}
    </div>
  )
}
