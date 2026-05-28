export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BriefingTask } from '@/types/briefing'
import PrintButton from './_components/PrintButton'

interface SnapshotFull {
  id: string
  data_briefing: string
  created_at: string
  note_generali: string | null
  generato_da_profile: { full_name: string } | null
  tasks: BriefingTask[]
}

const SEZIONI = [
  { key: 'urgenze', label: 'URGENZE' },
  { key: 'flusso_inceppato', label: 'FLUSSO INCEPPATO' },
  { key: 'materiali_ritardo', label: 'MATERIALI IN RITARDO' },
  { key: 'manuale', label: 'AGGIUNTE MANUALI' },
] as const

export default async function BriefingStampaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ persona?: string }>
}) {
  const { id } = await params
  const { persona } = await searchParams

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
  let tasks = s.tasks ?? []
  let personaName: string | null = null

  if (persona) {
    // Filtra solo i task assegnati a questa persona
    tasks = tasks.filter(t => t.assegnato_a === persona)
    const trovato = tasks[0]?.assegnato_a_profile?.full_name
    if (trovato) {
      personaName = trovato
    } else {
      // Prova a recuperare il nome dal profilo
      const { data: pf } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', persona)
        .single()
      personaName = pf?.full_name ?? null
    }
  }

  const dataLabel = new Date(s.data_briefing + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const ora = new Date(s.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page {
          margin: 1.5cm;
          size: A4;
        }
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 11pt;
          color: #000;
          background: #fff;
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <PrintButton />
      </div>

      <div className="p-8 max-w-3xl mx-auto print:p-0 print:max-w-none">
        {/* Intestazione */}
        <div className="border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold uppercase tracking-wide">OTTICA BIANCHI — Briefing Operativo</h1>
          <div className="mt-1 text-sm grid grid-cols-2 gap-1">
            <div><span className="font-semibold">Data:</span> <span className="capitalize">{dataLabel}</span></div>
            <div><span className="font-semibold">Generato da:</span> {s.generato_da_profile?.full_name ?? '—'} ore {ora}</div>
            {personaName && (
              <div className="col-span-2 mt-1">
                <span className="font-semibold">Assegnato a:</span>{' '}
                <span className="text-base font-bold">{personaName}</span>
              </div>
            )}
          </div>
          {s.note_generali && (
            <p className="mt-2 text-sm italic border-t pt-2 text-gray-700">{s.note_generali}</p>
          )}
        </div>

        {/* Sezioni */}
        {SEZIONI.map(({ key, label }) => {
          const sezioneItems = tasks.filter(t => t.sezione === key)
          if (sezioneItems.length === 0) return null

          return (
            <div key={key} className="mb-6">
              <h2 className="font-bold uppercase text-sm tracking-widest border-b border-gray-400 pb-1 mb-3">
                SEZIONE: {label}
              </h2>
              <div className="space-y-3">
                {sezioneItems.map(t => {
                  const busta = t.busta
                  const cliente = busta?.clienti
                  return (
                    <div key={t.id} className="flex items-start gap-3">
                      <span className="mt-0.5 text-lg leading-none shrink-0">□</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {busta?.readable_id ?? '—'} — {cliente?.cognome} {cliente?.nome}
                          {busta ? ` (${busta.tipo_lavorazione})` : ''}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{t.motivo}</p>
                        {t.nota_admin && (
                          <p className="text-xs mt-0.5">
                            <span className="font-semibold">Istruzione:</span> {t.nota_admin}
                          </p>
                        )}
                        {!persona && t.assegnato_a_profile?.full_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            → {t.assegnato_a_profile.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {tasks.length === 0 && (
          <p className="text-center text-gray-400 py-8 italic">Nessun task assegnato</p>
        )}

        {/* Firma finale */}
        <div className="mt-8 pt-4 border-t border-gray-400 text-sm flex items-center justify-between">
          <span>Firma: ________________________</span>
          <label className="flex items-center gap-2">
            <span className="border border-black w-4 h-4 inline-block" /> Consegnato
          </label>
          <span>Data: ___________</span>
        </div>
      </div>
    </>
  )
}
