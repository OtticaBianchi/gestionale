export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { ClipboardList, ArrowLeft, ChevronRight } from 'lucide-react'

interface SnapshotRow {
  id: string
  data_briefing: string
  created_at: string
  note_generali: string | null
  generato_da_profile: { full_name: string } | null
  total_tasks: number
  risolti: number
}

export default async function BriefingStoricoPage() {
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

  const { data: snapshots } = await db
    .from('briefing_snapshots')
    .select(`
      id,
      data_briefing,
      created_at,
      note_generali,
      generato_da_profile:generato_da(full_name),
      tasks:briefing_tasks(risolto)
    `)
    .order('data_briefing', { ascending: false })
    .limit(30)

  const rows: SnapshotRow[] = (snapshots ?? []).map((s: {
    id: string; data_briefing: string; created_at: string; note_generali: string | null;
    generato_da_profile: { full_name: string } | null;
    tasks: { risolto: boolean }[]
  }) => ({
    id: s.id,
    data_briefing: s.data_briefing,
    created_at: s.created_at,
    note_generali: s.note_generali,
    generato_da_profile: s.generato_da_profile,
    total_tasks: s.tasks?.length ?? 0,
    risolti: s.tasks?.filter((t) => t.risolto).length ?? 0,
  }))

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/briefing" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Storico Briefing
            </h1>
            <p className="text-sm text-gray-500">Ultimi 30 briefing salvati</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nessun briefing ancora generato</p>
            <Link href="/dashboard/briefing" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
              Genera il primo briefing →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => {
              const dataLabel = new Date(r.data_briefing + 'T12:00:00').toLocaleDateString('it-IT', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })
              const ora = new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
              const percRisolti = r.total_tasks > 0 ? Math.round((r.risolti / r.total_tasks) * 100) : 0

              return (
                <Link
                  key={r.id}
                  href={`/dashboard/briefing/${r.id}`}
                  className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 capitalize">{dataLabel}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>Generato alle {ora} da {r.generato_da_profile?.full_name ?? '—'}</span>
                      <span>·</span>
                      <span>{r.total_tasks} task · {r.risolti} risolti ({percRisolti}%)</span>
                    </div>
                    {r.note_generali && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{r.note_generali}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
