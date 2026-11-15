import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import {
  LAST_SEEN_COOKIE,
  isSessionExpired,
  lastSeenCookieOptions,
  toSessionCookieOptions,
} from '@/lib/supabase/session-cookies'

// Legge il ruolo dal JWT (app_metadata.role, popolato dal Custom Access Token
// Hook Supabase se/quando configurato — vedi supabase/migrations/20260807_add_custom_access_token_hook.sql)
// e interroga `profiles` solo come fallback, così il comportamento resta
// identico a prima finché l'Auth Hook non viene abilitato da Dashboard.
async function resolveUserRole(
  supabase: ReturnType<typeof createServerClient>,
  user: User
): Promise<string | null> {
  const claimRole = (user.app_metadata as Record<string, unknown> | undefined)?.role
  if (typeof claimRole === 'string' && claimRole) {
    return claimRole
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role ?? null
}

export async function middleware(request: NextRequest) {
  logger.debug('🔍 MIDDLEWARE START - URL:', request.nextUrl.pathname);

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
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...toSessionCookieOptions(options) })
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...toSessionCookieOptions(options) })
          })
        },
      },
    }
  )

  // Get user ONCE and reuse it
  logger.debug('🔍 MIDDLEWARE - Getting user via getUser...');
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
  let user = authUser

  if (userError) {
    console.warn('🔍 MIDDLEWARE - getUser error:', userError.message)
  }

  const { pathname } = request.nextUrl

  // I redirect devono portarsi dietro i cookie scritti sulla response (refresh/chiusura sessione)
  const redirectTo = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  // ===== SCADENZA SESSIONE PER INATTIVITÀ =====
  // Se il PC viene spento senza logout, la sessione non deve passare a chi accende il giorno dopo.
  // I flussi /auth/* (invito, reset password, magic link) creano la sessione lato client: li esentiamo,
  // insieme all'heartbeat con cui il client avvia il cookie di ultima attività.
  if (user) {
    const lastSeen = request.cookies.get(LAST_SEEN_COOKIE)?.value
    const isAuthFlow = pathname.startsWith('/auth/') || pathname === '/api/auth/heartbeat'

    if (!isAuthFlow && isSessionExpired(lastSeen)) {
      logger.debug('🔍 MIDDLEWARE - Session idle/expired, signing out');
      await supabase.auth.signOut({ scope: 'local' })
      response.cookies.set({ name: LAST_SEEN_COOKIE, value: '', ...lastSeenCookieOptions(), maxAge: 0 })
      user = null
    } else if (!lastSeen) {
      // Solo flussi /auth/*: la sessione nasce lato client, segniamo l'inizio attività
      response.cookies.set({ name: LAST_SEEN_COOKIE, value: String(Date.now()), ...lastSeenCookieOptions() })
    }
  }

  // ===== PROTEZIONE ADMIN/MANAGER ROUTES =====
  // 🔐 Protezione per rotte admin (solo admin)
  const adminPaths = [
    '/admin',
    '/dashboard/audit',
    '/dashboard/analytics',
    '/dashboard/briefing',
    '/dashboard/cestino',
    '/dashboard/admin',
    '/dashboard/governance',
    '/dashboard/procedure-suggestions',
    '/dashboard/procedure-compliance',
    '/errori',
    '/modules/fornitori',
    '/modules/marketing',
    '/modules/reactivation'
  ]
  const isAdminPath = adminPaths.some(path => pathname.startsWith(path))

  if (isAdminPath) {
    logger.debug('🔍 MIDDLEWARE - ADMIN PATH DETECTED:', pathname);

    if (!user) {
      logger.debug('🔍 MIDDLEWARE - ADMIN PATH - No authenticated user, redirecting to login');
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return redirectTo(redirectUrl)
    }

    // Check if user is admin
    const adminRole = await resolveUserRole(supabase, user)

    logger.debug('🔍 MIDDLEWARE - ADMIN CHECK - Profile role:', adminRole);

    if (adminRole !== 'admin') {
      logger.debug('🔍 MIDDLEWARE - ACCESS DENIED - User is not admin, redirecting to dashboard');
      return redirectTo(new URL('/dashboard?error=admin_required', request.url))
    }

    logger.debug('🔍 MIDDLEWARE - ADMIN ACCESS GRANTED');
  }

  // 🔐 Protezione per rotte manager-or-above (archive module)
  const managerPaths = [
    '/modules/archive',
    '/modules/operations',
    '/modules/voice-triage',
  ]
  const isManagerPath = managerPaths.some(path => pathname.startsWith(path))

  if (isManagerPath) {
    logger.debug('🔍 MIDDLEWARE - MANAGER PATH DETECTED:', pathname);
    if (!user) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return redirectTo(redirectUrl)
    }
    const managerRole = await resolveUserRole(supabase, user)
    if (managerRole !== 'admin' && managerRole !== 'manager') {
      return redirectTo(new URL('/dashboard?error=manager_required', request.url))
    }
  }

  // Proteggi le rotte che richiedono autenticazione
  const protectedPaths = ['/dashboard', '/buste', '/clienti', '/settings', '/onboarding', '/profilo', '/profile', '/modules']
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  logger.debug('🔍 MIDDLEWARE - isProtectedPath:', isProtectedPath);

  if (isProtectedPath) {
    logger.debug('🔍 MIDDLEWARE - PROTECTED PATH - User:', user ? `EXISTS (${user.id.slice(0, 8)})` : 'MISSING');

    if (!user) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      logger.debug('🔍 MIDDLEWARE - REDIRECTING TO LOGIN from protected path');
      return redirectTo(redirectUrl)
    }

    logger.debug('🔍 MIDDLEWARE - PROTECTED PATH - Session valid, allowing access');
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.includes(pathname)

  logger.debug('🔍 MIDDLEWARE - isAuthPath:', isAuthPath);

  if (isAuthPath) {
    logger.debug('🔍 MIDDLEWARE - AUTH PATH - User:', user ? `EXISTS (${user.id.slice(0, 8)})` : 'MISSING');

    if (user) {
      // Determine role to pick home destination
      const role = (await resolveUserRole(supabase, user)) || 'operatore'
      const home = '/dashboard' // Everyone goes to dashboard
      logger.debug('🔍 MIDDLEWARE - AUTH PATH - Redirecting to', home, 'for role:', role)
      return redirectTo(new URL(home, request.url))
    } else {
      logger.debug('🔍 MIDDLEWARE - AUTH PATH - No authenticated user, allowing login page');
    }
  }

  logger.debug('🔍 MIDDLEWARE - ALLOWING REQUEST TO CONTINUE');
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
