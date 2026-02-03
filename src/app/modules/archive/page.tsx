// app/modules/archive/page.tsx
import ArchiveClient from './_components/ArchiveClient'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ArchiveModulePage() {
  const supabase = await createServerSupabaseClient()

  // Auth + role (admin or manager)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/modules/archive')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role || 'operatore'
  const isAllowed = role === 'admin' || role === 'manager'
  if (!isAllowed) redirect('/dashboard?error=manager_required')

  return <ArchiveClient />
}
