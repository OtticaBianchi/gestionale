// app/modules/voice-triage/page.tsx
import { Database } from '@/types/database.types'
import VoiceNotesPage from '@/app/dashboard/voice-notes/page'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function VoiceTriageModulePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/modules/voice-triage')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/dashboard?error=manager_required')
  }

  // Reuse existing voice notes page as triage UI
  return <VoiceNotesPage />
}
