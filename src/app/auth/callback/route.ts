import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('🔍 CALLBACK START');
  
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('🔍 CALLBACK - Code present:', !!code);
  console.log('🔍 CALLBACK - Next URL:', next);
  console.log('🔍 CALLBACK - Origin:', origin);

  if (code) {
    console.log('🔍 CALLBACK - Processing code...');
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    try {
      console.log('🔍 CALLBACK - Exchanging code for session...');
      // Scambia il codice per la sessione
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('🔍 CALLBACK ERROR - Exchange failed:', error)
        return NextResponse.redirect(`${origin}/login?error=auth_error`)
      }

      console.log('🔍 CALLBACK SUCCESS - User:', data.user?.email);

      if (data.user) {
        console.log('🔍 CALLBACK - Checking user profile...');
        // Verifica se il profilo esiste, altrimenti crealo
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        console.log('🔍 CALLBACK - Profile check:', profileError ? `Error: ${profileError.code}` : 'Profile found');

        if (profileError && profileError.code === 'PGRST116') {
          console.log('🔍 CALLBACK - Creating new profile...');
          // Profilo non esiste, crealo
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Utente',
              role: 'operatore' // Ruolo default (operatore nel nuovo sistema)
            })

          if (insertError) {
            console.error('🔍 CALLBACK ERROR - Profile creation failed:', insertError)
          } else {
            console.log('🔍 CALLBACK - Profile created successfully');
          }
        }

        // Determina dove reindirizzare
        const hasCompletedOnboarding = profile?.business_config && 
          Object.keys(profile.business_config).length > 0

        console.log('🔍 CALLBACK - Has completed onboarding:', hasCompletedOnboarding);

        if (!hasCompletedOnboarding) {
          console.log('🔍 CALLBACK - REDIRECTING TO ONBOARDING');
          return NextResponse.redirect(`${origin}/onboarding/step/1`)
        }
      }

      console.log('🔍 CALLBACK - REDIRECTING TO:', `${origin}${next}`);
      return NextResponse.redirect(`${origin}${next}`)
    } catch (error) {
      console.error('🔍 CALLBACK EXCEPTION:', error)
      return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
    }
  }

  console.log('🔍 CALLBACK - No code provided, redirecting to login');
  // Se non c'è il codice, reindirizza al login
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}