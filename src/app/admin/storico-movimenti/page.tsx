import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Filter } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type LogRecord = {
  id: string
  busta_id: string
  from_status: string
  to_status: string
  user_id: string
  note: string | null
  metadata: any
  created_at: string
  buste?: {
    readable_id?: string | null
  } | null
  profiles?: {
    full_name?: string | null
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  nuove: 'Nuove',
  materiali_ordinati: 'Materiali ordinati',
  materiali_parzialmente_arrivati: 'Mat. parziali',
  materiali_arrivati: 'Mat. arrivati',
  in_lavorazione: 'In lavorazione',
  pronto_ritiro: 'Pronto ritiro',
  consegnato_pagato: 'Consegnato & pagato',
}

function formatStatus(value: string) {
  return STATUS_LABELS[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function parseDate(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export default async function StoricoMovimentiPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/admin/storico-movimenti')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard?error=admin_required')
  }

  const bustaFilter = typeof resolvedSearchParams.bustaId === 'string' ? resolvedSearchParams.bustaId.trim() : ''
  const userFilter = typeof resolvedSearchParams.userId === 'string' ? resolvedSearchParams.userId.trim() : ''
  const fromFilter = typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : ''
  const toFilter = typeof resolvedSearchParams.to === 'string' ? resolvedSearchParams.to : ''

  const fromDate = parseDate(fromFilter)
  const toDate = parseDate(toFilter)
  const toDateEnd = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)) : undefined

  let query = supabase
    .from('kanban_update_logs')
    .select(
      `id, busta_id, from_status, to_status, user_id, note, metadata, created_at,
       buste: busta_id (readable_id),
       profiles: user_id (full_name)`
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (bustaFilter) {
    const looksLikeUuid = /^[0-9a-fA-F-]{32,36}$/.test(bustaFilter)
    if (looksLikeUuid) {
      query = query.eq('busta_id', bustaFilter)
    } else {
      query = query.ilike('metadata->>readable_id', `%${bustaFilter}%`)
    }
  }

  if (userFilter) {
    query = query.eq('user_id', userFilter)
  }

  if (fromDate) {
    query = query.gte('created_at', fromDate.toISOString())
  }

  if (toDateEnd) {
    query = query.lte('created_at', toDateEnd.toISOString())
  }

  const [{ data: logs, error: logsError }, { data: users }] = await Promise.all([
    query,
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true }),
  ])

  if (logsError) {
    throw new Error(`Errore caricamento storico: ${logsError.message}`)
  }

  const rows: LogRecord[] = logs || []
  const total = rows.length

  const formattedRows = rows.map((log) => {
    const meta = (log.metadata || {}) as { readable_id?: string | null; history_warning?: string | null }
    const readableId = meta.readable_id || log.buste?.readable_id || '—'
    const historyWarning = meta.history_warning || null
    return {
      ...log,
      readableId,
      historyWarning,
    }
  })

  const userOptions = (users || [])
    .map((entry) => ({ id: entry.id, name: entry.full_name || 'Senza nome' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla Dashboard
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Storico Movimenti Kanban</h1>
        <p className="text-sm text-gray-600">
          Visualizza e filtra tutti gli spostamenti delle buste. Mostriamo gli ultimi 200 eventi, filtrabili per busta, operatore e intervallo di date.
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4" method="get">
          <div>
            <label htmlFor="bustaId" className="block text-sm font-medium text-gray-700 mb-1">
              Busta ID / Codice leggibile
            </label>
            <input
              id="bustaId"
              name="bustaId"
              defaultValue={bustaFilter}
              placeholder="UUID o codice"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              Operatore
            </label>
            <select
              id="userId"
              name="userId"
              defaultValue={userFilter}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="from" className="block text-sm font-medium text-gray-700 mb-1">
              Dal giorno
            </label>
            <input
              type="date"
              id="from"
              name="from"
              defaultValue={fromFilter}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
              Al giorno
            </label>
            <input
              type="date"
              id="to"
              name="to"
              defaultValue={toFilter}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-4 flex flex-wrap items-center gap-3 justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              <Filter className="w-4 h-4" />
              Applica filtri
            </button>
            {(bustaFilter || userFilter || fromFilter || toFilter) && (
              <Link
                href="/admin/storico-movimenti"
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Reimposta filtri
              </Link>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            {total === 0 ? 'Nessun movimento trovato' : `Mostrati ${total} movimenti (max 200)`}
          </h2>
        </div>

        {total === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Nessun movimento corrisponde ai filtri selezionati.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Data</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Busta</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Da</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">A</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Operatore</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formattedRows.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-medium">{log.readableId}</div>
                      <div className="text-xs text-gray-500">{log.busta_id}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatStatus(log.from_status)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatStatus(log.to_status)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{log.profiles?.full_name || 'Sconosciuto'}</div>
                      <div className="text-xs text-gray-500">{log.user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{log.note || '—'}</div>
                      {log.historyWarning && (
                        <div className="text-xs text-amber-600 mt-1">{log.historyWarning}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
