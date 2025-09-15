'use client'

import { useState } from 'react'
import { FollowUpClient } from './_components/FollowUpClient'

export default function FollowUpPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Follow-up Chiamate</h1>
        <p className="text-gray-600 mt-2">
          Gestione chiamate di soddisfazione post-vendita
        </p>
      </div>

      <FollowUpClient />
    </div>
  )
}