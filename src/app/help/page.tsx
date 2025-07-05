'use client'

import { LifeBuoy, Mail, Phone } from 'lucide-react'

export default function HelpPage() {
  return (
    // NOTA: Questa pagina sarà avvolta dal layout principale una volta creato.
    // Per ora, è un componente autonomo.
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <LifeBuoy className="w-10 h-10 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Assistenza e Supporto
          </h1>
        </div>

        <div className="p-8 bg-white rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Hai bisogno di aiuto?
          </h2>
          <p className="text-gray-600 mb-6">
            Se riscontri problemi tecnici con il sistema gestionale, hai domande sul suo funzionamento o suggerimenti per migliorarlo, non esitare a contattarci.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Supporto Telefonico</h3>
              </div>
              <p className="text-gray-600">
                Per problemi urgenti, contatta il numero interno:
              </p>
              <a href="tel:+39123456789" className="text-lg font-bold text-gray-800 hover:text-blue-600">
                123-456-789
              </a>
            </div>

            <div className="p-6 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Supporto via Email</h3>
              </div>
              <p className="text-gray-600">
                Per richieste non urgenti e segnalazioni, scrivi a:
              </p>
              <a href="mailto:supporto.gestionale@otticabianchi.it" className="text-lg font-bold text-gray-800 hover:text-blue-600 break-all">
                supporto.gestionale@otticabianchi.it
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}