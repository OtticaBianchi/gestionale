'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔑 LOGIN - Starting client-side login with fixed UserContext...')
    console.log('🔑 LOGIN - Email:', email)
    
    setError(null)
    setIsLoading(true)
    
    try {
      console.log('🔑 LOGIN - Calling signInWithPassword (should work now)...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('🔑 LOGIN - SignIn completed:', {
        success: !error,
        error: error?.message,
        user: data?.user?.email
      })
      
      if (error) {
        console.log('🔑 LOGIN - Error occurred:', error.message)
        setError(error.message === 'Invalid login credentials' ? 'Email o password non validi.' : error.message)
        setIsLoading(false)
        return
      }

      if (data?.user) {
        console.log('🔑 LOGIN - Success! User authenticated, UserContext will handle redirect...')
        // UserContext will load profile and redirect automatically
        // Keep loading state until redirect happens
      } else {
        setError('Login fallito - nessun utente ricevuto')
        setIsLoading(false)
      }
      
    } catch (e) {
      console.error('🔑 LOGIN - Unexpected error:', e)
      setError('Si è verificato un errore imprevisto.')
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setError(null)
    if (!email) {
      setError('Inserisci la tua email per ricevere il link magico.')
      return
    }
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        alert('Controlla la tua email per il link d\'accesso!')
      }
    } catch (e) {
      setError('Si è verificato un errore imprevisto.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Accesso Gestionale
        </h2>

        {error && (
          <div className="flex items-center p-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
            <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        {/* Link reset password */}
        <div className="flex items-center justify-between text-sm">
          <div></div>
          <a href="/reset-password" className="text-blue-600 hover:underline">Password dimenticata?</a>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Oppure</span>
          </div>
        </div>
        
        <button
          onClick={handleMagicLink}
          disabled={isLoading || !email}
          className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-100"
        >
          Invia link d'accesso rapido
        </button>

        <div className="text-sm text-center text-gray-500">
          La creazione di account è consentita solo su invito
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
          <div className="text-center">Caricamento...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
