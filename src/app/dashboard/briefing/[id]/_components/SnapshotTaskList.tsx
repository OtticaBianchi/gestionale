'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BriefingTask } from '@/types/briefing'
import SectionBlock from '../../_components/SectionBlock'

interface SnapshotTaskListProps {
  snapshotId: string
  tasks: BriefingTask[]
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

function TaskRow({ task, snapshotId, onToggle }: {
  task: BriefingTask & { risolto_local?: boolean }
  snapshotId: string
  onToggle: (taskId: string, value: boolean) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/briefing/${snapshotId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risolto: checked }),
      })
      if (!res.ok) throw new Error()
      onToggle(task.id, checked)
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const busta = task.busta
  const cliente = busta?.clienti

  return (
    <div className={`border rounded-lg p-3 bg-white shadow-sm ${task.risolto_local ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {busta && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatoBadgeColor(busta.stato_attuale)}`}>
                {busta.stato_attuale.replace('_', ' ')}
              </span>
            )}
            <span className="font-mono text-sm font-semibold text-gray-800">{busta?.readable_id ?? '—'}</span>
            {cliente && (
              <span className="text-sm text-gray-700">— {cliente.cognome} {cliente.nome}</span>
            )}
            {busta && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{busta.tipo_lavorazione}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{task.motivo}</p>
          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
            {task.assegnato_a && (
              <p>Assegnato a: <span className="font-medium text-gray-700">{task.assegnato_a_profile?.full_name ?? task.assegnato_a}</span></p>
            )}
            {task.nota_admin && (
              <p>Istruzione: <span className="italic">{task.nota_admin}</span></p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600 shrink-0">
          <input
            type="checkbox"
            checked={task.risolto_local ?? task.risolto}
            disabled={loading}
            onChange={e => handleToggle(e.target.checked)}
            className="rounded"
          />
          Risolto
        </label>
      </div>
    </div>
  )
}

export default function SnapshotTaskList({ snapshotId, tasks: initialTasks }: SnapshotTaskListProps) {
  const [tasks, setTasks] = useState(initialTasks.map(t => ({ ...t, risolto_local: t.risolto })))

  const handleToggle = (taskId: string, value: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, risolto_local: value } : t))
  }

  const sezioni = [
    { key: 'urgenze', label: 'Urgenze', icon: '🔴' },
    { key: 'flusso_inceppato', label: 'Flusso Inceppato', icon: '⏱' },
    { key: 'materiali_ritardo', label: 'Materiali in Ritardo', icon: '📦' },
    { key: 'manuale', label: 'Aggiunte Manuali', icon: '✏️' },
  ] as const

  return (
    <div className="space-y-4">
      {sezioni.map(({ key, label, icon }) => {
        const items = tasks.filter(t => t.sezione === key)
        if (items.length === 0) return null
        return (
          <SectionBlock key={key} title={label} icon={icon} count={items.length}>
            {items.map(t => (
              <TaskRow key={t.id} task={t} snapshotId={snapshotId} onToggle={handleToggle} />
            ))}
          </SectionBlock>
        )
      })}

      {tasks.length === 0 && (
        <p className="text-center text-gray-400 py-8">Nessun task in questo briefing</p>
      )}
    </div>
  )
}
