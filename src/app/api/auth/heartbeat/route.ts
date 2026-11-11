export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { touchLastSeen } from '@/lib/supabase/session-cookies'

// Chiamata dal client solo quando l'utente è realmente attivo (mouse/tastiera/touch).
// Rinnova il cookie di ultima attività usato dal middleware per la scadenza per inattività.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  touchLastSeen(await cookies())
  return NextResponse.json({ ok: true })
}
