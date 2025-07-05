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

  // Proteggi le rotte che richiedono autenticazione
  const protectedPaths = ['/dashboard', '/buste', '/clienti', '/settings', '/onboarding']
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
      console.log('🔍 MIDDLEWARE - REDIRECTING TO DASHBOARD from auth path');
      return NextResponse.redirect(new URL('/dashboard', request.url))
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
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}