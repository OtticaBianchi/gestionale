'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Send } from 'lucide-react'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      })
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    } catch (e: any) {
      setError(e.message || 'Errore imprevisto')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Recupera password</h2>

        {sent ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            Ti abbiamo inviato un'email con il link per cambiare password.
          </div>
        ) : (
          <>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
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
            <button
              onClick={handleSend}
              disabled={!email}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" /> Invia link di reset
            </button>
          </>
        )}

        <div className="text-sm text-center">
          <a href="/login" className="text-blue-600 hover:underline">Torna al login</a>
        </div>
      </div>
    </div>
  )
}

