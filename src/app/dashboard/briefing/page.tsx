export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/layout/DashboardLayout'
import BriefingClient from './_components/BriefingClient'

export default async function BriefingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard?error=admin_required')

  // Carica profili admin + manager per il dropdown assegnazione
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'manager'])
    .order('full_name')

  const profiles = (profilesRaw ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name ?? '',
    role: p.role ?? '',
  }))

  return (
    <DashboardLayout>
      <BriefingClient
        currentUserId={user.id}
        currentUserName={profile?.full_name ?? ''}
        assignableProfiles={profiles}
      />
    </DashboardLayout>
  )
}
