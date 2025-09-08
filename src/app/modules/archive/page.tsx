// app/modules/archive/page.tsx
import { Database } from '@/types/database.types'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ArchiveModulePage() {
  const supabase = createServerSupabaseClient()

  // Auth + role (admin or manager)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="p-8">Devi effettuare l'accesso</div>
    )
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role || 'operatore'
  const isAllowed = role === 'admin' || role === 'manager'
  if (!isAllowed) {
    return (
      <div className="p-8">Accesso riservato a amministratori o manager</div>
    )
  }

  // Archived definition: consegnato_pagato with updated_at older than 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: buste, error } = await supabase
    .from('buste')
    .select(`
      id,
      readable_id,
      stato_attuale,
      updated_at,
      data_apertura,
      clienti:cliente_id (id, nome, cognome, telefono)
    `)
    .eq('stato_attuale', 'consegnato_pagato')
    .lt('updated_at', sevenDaysAgo.toISOString())
    .order('updated_at', { ascending: false })

  if (error) {
    return <div className="p-6 text-red-600">Errore caricamento archivio</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Archivio Buste</h1>
        <p className="text-sm text-gray-600">Buste consegnate e pagate (archiviate dopo 7 giorni)</p>
      </div>

      <div className="p-6">
        {(!buste || buste.length === 0) ? (
          <div className="text-gray-500">Nessuna busta archiviata trovata</div>
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Aggiornata</th>
                  <th className="text-left px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {buste!.map((b: any) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2 font-medium text-gray-800">{b.readable_id || b.id}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {b.clienti ? `${b.clienti.cognome} ${b.clienti.nome}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{b.updated_at ? new Date(b.updated_at).toLocaleString('it-IT') : '—'}</td>
                    <td className="px-4 py-2 space-x-2">
                      <Link href={`/dashboard/buste/${b.id}`} className="text-blue-600 hover:underline">Apri</Link>
                      <Link href={`/dashboard/buste/${b.id}`} className="text-gray-600 hover:underline">Dettagli</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
