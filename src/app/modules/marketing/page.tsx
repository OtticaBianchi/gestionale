import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MarketingClient from './_components/MarketingClient'

export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Only admins can access marketing
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard?error=admin_required')
  }

  return <MarketingClient />
}
