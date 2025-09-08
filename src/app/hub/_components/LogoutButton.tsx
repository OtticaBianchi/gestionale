'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useUser } from '@/context/UserContext'

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { signOut } = useUser()

  const handleLogout = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    console.log('🔐 HUB - Starting logout...')
    
    try {
      await signOut('manual')
    } catch (error) {
      console.error('🔐 HUB - Logout error:', error)
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
      title="Logout"
    >
      <LogOut className="h-4 w-4" />
      <span>{isLoading ? 'Uscita...' : 'Esci'}</span>
    </button>
  )
}