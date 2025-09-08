'use client'

import { useState, useMemo } from 'react'
import { KeyRound, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => 
    password.length >= 6 && password === confirm && !loading
  , [password, confirm, loading])

  const handleUpdate = async () => {
    if (!canSubmit) return
    
    setError(null)
    setLoading(true)
    
    console.log('🔐 CLIENT - Starting password update...')
    
    try {
      // Validate inputs
      if (password.length < 6) {
        throw new Error('La password deve essere di almeno 6 caratteri')
      }
      
      if (password !== confirm) {
        throw new Error('Le password non coincidono')
      }
      
      // Call our API endpoint
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })
      
      const result = await response.json()
      
      console.log('🔐 CLIENT - API Response:', {
        status: response.status,
        success: result.success,
        error: result.error
      })
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Errore durante l\'aggiornamento della password')
      }
      
      console.log('🔐 CLIENT - Password updated successfully!')
      setSaved(true)
      
      // Redirect after success
      setTimeout(() => {
        router.push('/login?message=password_updated')
      }, 2000)
      
    } catch (e: any) {
      console.error('🔐 CLIENT - Password update error:', e)
      setError(e.message || 'Errore imprevisto durante l\'aggiornamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Imposta nuova password</h2>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        
        {saved && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
            <CheckCircle className="w-4 h-4" /> Password aggiornata con successo! Reindirizzamento al login...
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="sr-only">Nuova password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <KeyRound className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nuova password (min 6 caratteri)"
                disabled={loading || saved}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="confirm" className="sr-only">Conferma password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Conferma password"
              disabled={loading || saved}
            />
          </div>
          
          <button
            onClick={handleUpdate}
            disabled={!canSubmit || saved}
            className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvataggio...
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Completato!
              </>
            ) : (
              'Salva nuova password'
            )}
          </button>
        </div>

        <div className="text-sm text-center">
          <a href="/login" className="text-blue-600 hover:underline">Torna al login</a>
        </div>
      </div>
    </div>
  )
}