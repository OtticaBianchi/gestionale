'use client'

import { useState } from 'react'
import Link from 'next/link'
// import { ChevronLeftIcon } from '@heroicons/react/24/outline' // Not available
import { FollowUpClient } from './_components/FollowUpClient'

export default function FollowUpPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        {/* Back button */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Torna alla Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">Follow-up Chiamate</h1>
        <p className="text-gray-600 mt-2">
          Gestione chiamate di soddisfazione post-vendita
        </p>
      </div>

      <FollowUpClient />
    </div>
  )
}