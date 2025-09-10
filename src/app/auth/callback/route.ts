import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log('🔍 CALLBACK START');
  
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'

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
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        console.log('🔍 CALLBACK - Profile check:', profileError ? `Error: ${profileError.code}` : 'Profile found');
        console.log('🔍 CALLBACK - User metadata:', JSON.stringify(data.user.user_metadata, null, 2));

        if (profileError && profileError.code === 'PGRST116') {
          console.log('🔍 CALLBACK - Creating new profile...');
          console.log('🔍 CALLBACK - User metadata:', JSON.stringify(data.user.user_metadata, null, 2));
          // Profilo non esiste, crealo
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.full_name || 
                        data.user.user_metadata?.name || 
                        data.user.identities?.[0]?.identity_data?.full_name ||
                        data.user.email?.split('@')[0] || 'Utente',
              // Use invited role if present, fallback to 'operatore'
              role: (data.user.user_metadata as any)?.role || 'operatore'
            })
            .select()
            .single()

          if (insertError) {
            console.error('🔍 CALLBACK ERROR - Profile creation failed:', insertError)
            return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`)
          } else {
            console.log('🔍 CALLBACK - Profile created successfully:', newProfile);
            profile = newProfile; // Update profile variable for onboarding check
          }
        } else if (!profileError && profile) {
          // Sync role from user metadata if invited role differs
          const invitedRole = (data.user.user_metadata as any)?.role as string | undefined
          const allowed = new Set(['admin', 'manager', 'operatore'])
          if (invitedRole && allowed.has(invitedRole) && profile.role !== invitedRole) {
            const { data: synced, error: syncErr } = await supabase
              .from('profiles')
              .update({ role: invitedRole, updated_at: new Date().toISOString() })
              .eq('id', data.user.id)
              .select('*')
              .single()
            if (!syncErr && synced) {
              profile = synced
            }
          }
        }

      console.log('🔍 CALLBACK - Role-based default landing');
      // If no explicit next, choose by role (admin/manager -> hub)
      if (!searchParams.get('next')) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
        if (prof && (prof.role === 'admin' || prof.role === 'manager')) {
          next = '/dashboard'  // Everyone goes to dashboard
        }
      }
      }

      console.log('🔍 CALLBACK - REDIRECTING TO:', `${origin}${next}`);
      // Force redirect to dashboard for new users
      const redirectUrl = `${origin}${next}`;
      console.log('🔍 CALLBACK - Final redirect URL:', redirectUrl);
      return NextResponse.redirect(redirectUrl)
    } catch (error) {
      console.error('🔍 CALLBACK EXCEPTION:', error)
      return NextResponse.redirect(`${origin}/login?error=unexpected_error`)
    }
  }

  console.log('🔍 CALLBACK - No code provided, redirecting to login');
  // Se non c'è il codice, reindirizza al login
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
