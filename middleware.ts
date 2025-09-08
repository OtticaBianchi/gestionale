import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  console.log('🔍 MIDDLEWARE START - URL:', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Aggiorna la sessione (questa è la riga più importante!)
  console.log('🔍 MIDDLEWARE - Getting session...');
  await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // ===== PROTEZIONE ADMIN/MANAGER ROUTES =====
  // 🔐 Protezione per rotte admin (solo admin)
  const adminPaths = ['/admin', '/modules/voice-triage']
  const isAdminPath = adminPaths.some(path => pathname.startsWith(path))

  if (isAdminPath) {
    console.log('🔍 MIDDLEWARE - ADMIN PATH DETECTED:', pathname);
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('🔍 MIDDLEWARE - ADMIN PATH - No session, redirecting to login');
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    console.log('🔍 MIDDLEWARE - ADMIN CHECK - Profile role:', profile?.role);

    if (profileError || profile?.role !== 'admin') {
      console.log('🔍 MIDDLEWARE - ACCESS DENIED - User is not admin, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url))
    }

    console.log('🔍 MIDDLEWARE - ADMIN ACCESS GRANTED');
  }

  // 🔐 Protezione per rotte manager-or-above (archive module)
  const managerPaths = ['/modules/archive', '/modules/operations']
  const isManagerPath = managerPaths.some(path => pathname.startsWith(path))

  if (isManagerPath) {
    console.log('🔍 MIDDLEWARE - MANAGER PATH DETECTED:', pathname);
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.redirect(new URL('/dashboard?error=manager_required', request.url))
    }
  }

  // Proteggi le rotte che richiedono autenticazione
  const protectedPaths = ['/dashboard', '/buste', '/clienti', '/settings', '/onboarding', '/profilo', '/profile', '/modules']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  console.log('🔍 MIDDLEWARE - isProtectedPath:', isProtectedPath);

  if (isProtectedPath) {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('🔍 MIDDLEWARE - PROTECTED PATH - Session:', session ? `EXISTS (${session.user.email})` : 'MISSING');
    
    if (!session) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      console.log('🔍 MIDDLEWARE - REDIRECTING TO LOGIN from protected path');
      return NextResponse.redirect(redirectUrl)
    } else {
      console.log('🔍 MIDDLEWARE - PROTECTED PATH - Session valid, allowing access');
    }
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.includes(pathname)

  console.log('🔍 MIDDLEWARE - isAuthPath:', isAuthPath);

  if (isAuthPath) {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('🔍 MIDDLEWARE - AUTH PATH - Session:', session ? `EXISTS (${session.user.email})` : 'MISSING');
    
    if (session) {
      // Determine role to pick home destination
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      const role = profile?.role || 'operatore'
      const home = '/dashboard' // Everyone goes to dashboard
      console.log('🔍 MIDDLEWARE - AUTH PATH - Redirecting to', home, 'for role:', role)
      return NextResponse.redirect(new URL(home, request.url))
    } else {
      console.log('🔍 MIDDLEWARE - AUTH PATH - No session, allowing login page');
    }
  }

  console.log('🔍 MIDDLEWARE - ALLOWING REQUEST TO CONTINUE');
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Speed Insights & altre integrazioni)
     * - favicon.ico (favicon file)
     * - file statici comuni (js, css, map, json, media)
     */
    '/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|js|css|map|json|mp3|ogg|wav)$).*)',
  ],
}
