'use client'

import Link from 'next/link'
import { Shield, Mail } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center space-x-2 justify-center">
          <Shield className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-center text-gray-900">
            Registrazione su invito
          </h2>
        </div>

        <p className="text-gray-700 text-center">
          La creazione di nuovi account è consentita solo tramite invito da parte di un amministratore.
        </p>

        <div className="space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Se ti serve un accesso, contatta l'amministratore.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span>Oppure invia una richiesta da /profile</span>
          </div>
        </div>

        <div className="pt-4 text-center">
          <Link href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Torna al Login
          </Link>
        </div>
      </div>
    </div>
  )
}
