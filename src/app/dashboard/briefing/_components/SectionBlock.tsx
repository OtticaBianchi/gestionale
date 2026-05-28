'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface SectionBlockProps {
  title: string
  icon: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function SectionBlock({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: SectionBlockProps) {
  const [open, setOpen] = useState(defaultOpen && count > 0)

  return (
    <div className="border rounded-xl overflow-hidden bg-gray-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors border-b"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <span>{icon}</span>
          <span>{title}</span>
          <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{count}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {count === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Nessuna busta in questa sezione</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}
