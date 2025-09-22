 'use client'

import { useUser } from '@/context/UserContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User, LayoutDashboard, LifeBuoy, Settings, Menu, X, Sun, Moon, Shield } from 'lucide-react'
import { useState } from 'react'

// --- COMPONENTE HEADER ---
function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useUser()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 sm:px-6 z-10">
      <button onClick={onMenuClick} className="md:hidden p-2">
        <Menu className="w-6 h-6 text-gray-600" />
      </button>
      <div className="text-xl font-semibold text-gray-800 hidden md:block">
        Gestionale Ottica Bianchi
      </div>
      <div className="flex items-center gap-4">
        {/* Qui potremmo aggiungere un selettore light/dark mode in futuro */}
        <div className="relative">
          <button onClick={() => router.push('/profile')} className="flex items-center gap-2">
            <img 
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=random`}
              alt="Avatar utente"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="hidden sm:inline font-medium text-sm text-gray-700">{profile?.full_name}</span>
          </button>
        </div>
        <button onClick={handleSignOut} title="Logout" className="p-2 hover:bg-gray-100 rounded-full">
            <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  )
}

// --- COMPONENTE SIDEBAR ---
function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const router = useRouter()
  const { profile } = useUser()
  
  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/profile', icon: User, label: 'Profilo' },
    // Hub removed - reverting to dashboard-centric approach
    { href: '/settings', icon: Settings, label: 'Impostazioni' },
    { href: '/help', icon: LifeBuoy, label: 'Assistenza' },
    // Modules (role-aware)
    ...(profile?.role === 'admin' ? [
      { href: '/modules/voice-triage', icon: Shield, label: 'Voice Triage' },
      { href: '/modules/archive', icon: Shield, label: 'Archivio Buste' },
      { href: '/modules/operations', icon: Shield, label: 'Console Operativa' },
    ] : []),
    ...(profile?.role === 'manager' ? [
      { href: '/modules/archive', icon: Shield, label: 'Archivio Buste' },
      { href: '/modules/operations', icon: Shield, label: 'Console Operativa' },
    ] : []),
    // Admin-only utilities
    ...(profile?.role === 'admin' ? [
      { href: '/admin/users', icon: Shield, label: 'Utenti (Admin)' },
      { href: '/admin/storico-movimenti', icon: Shield, label: 'Storico Movimenti' },
      { href: '/admin/avatar-management', icon: Shield, label: 'Avatar (Admin)' },
    ] : [])
  ]
  
  return (
    <>
      {/* Overlay per mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClose()
          }
        }}
        role="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label="Chiudi menu"
      ></div>
      
      {/* Sidebar effettiva */}
      <aside className={`fixed top-0 left-0 h-full bg-gray-800 text-white w-64 z-30 transform transition-transform md:relative md:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
          <h1 className="text-lg font-bold">Menu</h1>
          <button onClick={onClose} className="md:hidden p-2">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4">
          <ul>
            {navItems.map(item => (
              <li key={item.href}>
                <Link href={item.href} onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors">
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}


// --- LAYOUT PRINCIPALE ---
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useUser()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Se i dati sono in caricamento, mostra uno spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Se non c'è utente (dopo il caricamento), reindirizza al login
  // Questo è un fallback, il middleware dovrebbe già averlo fatto
  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-col flex-1">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
