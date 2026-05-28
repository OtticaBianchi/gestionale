export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { ClipboardList, ArrowLeft, Printer } from 'lucide-react'
import { BriefingTask } from '@/types/briefing'
import SnapshotTaskList from './_components/SnapshotTaskList'

interface SnapshotFull {
  id: string
  data_briefing: string
  created_at: string
  note_generali: string | null
  generato_da_profile: { full_name: string } | null
  tasks: BriefingTask[]
}

export default async function BriefingSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard?error=admin_required')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: snapshot, error } = await db
    .from('briefing_snapshots')
    .select(`
      id,
      data_briefing,
      created_at,
      note_generali,
      generato_da_profile:generato_da(full_name),
      tasks:briefing_tasks(
        *,
        assegnato_a_profile:assegnato_a(full_name),
        busta:busta_id(
          readable_id,
          tipo_lavorazione,
          stato_attuale,
          priorita,
          note_generali,
          updated_at,
          clienti(nome, cognome, telefono)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !snapshot) notFound()

  const s = snapshot as SnapshotFull
  const dataLabel = new Date(s.data_briefing + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const ora = new Date(s.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const totalTasks = s.tasks?.length ?? 0
  const risolti = s.tasks?.filter(t => t.risolto).length ?? 0

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/briefing/storico" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                <span className="capitalize">{dataLabel}</span>
              </h1>
              <p className="text-sm text-gray-500">
                Generato alle {ora} da {s.generato_da_profile?.full_name ?? '—'}
                {' · '}
                {totalTasks} task · {risolti} risolti
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/briefing/stampa/${id}`}
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2"
          >
            <Printer className="w-4 h-4" />
            Stampa
          </Link>
        </div>

        {s.note_generali && (
          <div className="border rounded-lg p-3 bg-yellow-50 text-sm text-yellow-800">
            {s.note_generali}
          </div>
        )}

        {/* Task list con checkbox risolto interattiva */}
        <SnapshotTaskList snapshotId={id} tasks={s.tasks ?? []} />
      </div>
    </DashboardLayout>
  )
}
