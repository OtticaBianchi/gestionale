'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-white border shadow rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <Printer className="w-4 h-4" />
      Stampa
    </button>
  )
}
