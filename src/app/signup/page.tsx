'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, Mail, AlertCircle } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // Passiamo i dati extra che verranno salvati in user_metadata
          // e usati dal nostro trigger per creare il profilo
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess('Registrazione completata! Controlla la tua email per il link di conferma.')
      }
    } catch (e) {
      setError('Si è verificato un errore imprevisto durante la registrazione.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Crea un Nuovo Account
        </h2>

        {error && (
          <div className="flex items-center p-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
            <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-3" />
            <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="p-4 text-sm text-green-800 rounded-lg bg-green-50" role="alert">
            {success}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-6">
        <div>
            <label htmlFor="fullName" className="sr-only">Nome Completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="fullName" name="fullName" type="text" required
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md"
                placeholder="Nome Completo"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="email" name="email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md"
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
                id="password" name="password" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md"
                placeholder="Password (min. 6 caratteri)"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !!success}
            className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? 'Creazione in corso...' : 'Registrati'}
          </button>
        </form>

        <div className="text-sm text-center">
          <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Hai già un account? Accedi
          </a>
        </div>
      </div>
    </div>
  )
}