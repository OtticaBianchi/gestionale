"use client"

import { createClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'

// 1. Importiamo i tipi dal nostro file generato
import { Database } from '@/types/database.types'

// 2. Definiamo il nostro tipo 'Profile' come un alias del tipo generato da Supabase.
//    Tables<'profiles'>['Row'] è il modo in cui accediamo alla definizione della riga della tabella 'profiles'.
type Profile = Database['public']['Tables']['profiles']['Row']

interface UserContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Hook per il timer di inattività (FIXED per memory leaks)
const useIdleTimer = (onIdle: () => void, idleTimeout: number) => {
  const timeoutId = useRef<NodeJS.Timeout | null>(null)
  const onIdleRef = useRef(onIdle)
  
  // Aggiorna la ref per evitare stale closures
  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current)
    }
    timeoutId.current = setTimeout(() => onIdleRef.current(), idleTimeout)
  }, [idleTimeout])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    const handleActivity = resetTimer

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }))
    resetTimer()

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current)
        timeoutId.current = null
      }
      events.forEach(event => window.removeEventListener(event, handleActivity))
    }
  }, [resetTimer])
}


export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Riferimenti per il tracciamento del tempo online
  const sessionStartTimeRef = useRef<number | null>(null)
  const lastActivityTimeRef = useRef<number | null>(null)
  const totalActiveTimeRef = useRef<number>(0)
  
  const supabase = createClient()

  // Funzione per caricare il profilo utente - CORRETTA
  const loadProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code !== 'PGRST116') { // 'PGRST116' = riga non trovata (normale per nuovi utenti)
          console.error('Error loading profile:', error)
        }
        return null
      }
      return data as Profile
    } catch (error) {
      console.error('Unexpected error loading profile:', error)
      return null
    }
  }

  // Funzione per aggiornare manualmente i dati del profilo
  const refreshProfile = async () => {
    if (user) {
      const profileData = await loadProfile(user.id)
      setProfile(profileData)
    }
  }

  // Funzione per tracciare e inviare il tempo della sessione
  const trackAndSendSessionTime = async () => {
    if (!sessionStartTimeRef.current || !user) return

    const now = Date.now()
    if (lastActivityTimeRef.current) {
      totalActiveTimeRef.current += now - lastActivityTimeRef.current
    }
    
    const totalDurationSeconds = Math.round(totalActiveTimeRef.current / 1000)

    if (totalDurationSeconds > 0) {
      try {
        const blob = new Blob([JSON.stringify({ duration: totalDurationSeconds })], { type: 'application/json' })
        navigator.sendBeacon(`/api/track-time`, blob)
        console.log(`Sent session duration: ${totalDurationSeconds}s`)
      } catch (error) {
        console.error('Error sending session time:', error)
      }
    }
    
    sessionStartTimeRef.current = null
    totalActiveTimeRef.current = 0
    lastActivityTimeRef.current = null
  }

  // Funzione di logout aggiornata
  const signOut = async (reason: 'idle' | 'manual' = 'manual') => {
    console.log(`Signing out due to: ${reason}`)
    try {
      await trackAndSendSessionTime()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Unexpected error during signout:', error)
    }
    // Il cleanup dello stato (user, profile, etc.) è gestito da onAuthStateChange
  }
  
  // Attiva il timer di inattività
  useIdleTimer(() => {
    if (user) {
      signOut('idle')
    }
  }, 10 * 60 * 1000) // 10 minuti

  useEffect(() => {
    // Flag per prevenire state updates dopo unmount
    let isMounted = true
    
    // Carica la sessione e il profilo all'avvio
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()

        if (!isMounted) return // Evita state update se component è unmounted

        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession?.user) {
          const profileData = await loadProfile(initialSession.user.id)
          if (isMounted) setProfile(profileData)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    getInitialSession()

    // Listener per i cambiamenti di stato dell'autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event)
      
      if (!isMounted) return // Evita state update se component è unmounted
      
      // Evita loop se la sessione non è cambiata realmente
      if (session?.access_token === newSession?.access_token && session?.user?.id === newSession?.user?.id) {
        return
      }
      
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        const profileData = await loadProfile(newSession.user.id)
        if (isMounted) setProfile(profileData)
        
        if (!sessionStartTimeRef.current) { // Avvia il tracking se non già attivo
          sessionStartTimeRef.current = Date.now()
          lastActivityTimeRef.current = Date.now()
          totalActiveTimeRef.current = 0
        }

      } else if (event === 'SIGNED_OUT') {
        if (isMounted) setProfile(null)
        
        // Resetta i contatori per sicurezza (dovrebbe essere già fatto in signOut)
        sessionStartTimeRef.current = null
        totalActiveTimeRef.current = 0
        lastActivityTimeRef.current = null
      }
      
      if (isMounted) setIsLoading(false)
    })

    // Listeners per la visibilità della pagina e la chiusura della finestra
    const handleVisibilityChange = () => {
      if (!sessionStartTimeRef.current) return
      
      if (document.visibilityState === 'hidden') {
        if(lastActivityTimeRef.current) {
          totalActiveTimeRef.current += Date.now() - lastActivityTimeRef.current
        }
        lastActivityTimeRef.current = null
      } else {
        lastActivityTimeRef.current = Date.now()
      }
    }

    const handleBeforeUnload = () => {
      trackAndSendSessionTime()
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      // Cleanup flag per prevenire memory leaks
      isMounted = false
      
      // Cleanup subscription (CRITICO per memory leaks)
      subscription.unsubscribe()
      
      // Cleanup event listeners
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, []) // Rimosso supabase.auth per evitare re-render infiniti

  const value: UserContextType = {
    user,
    session,
    profile,
    isLoading,
    signOut,
    refreshProfile,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

// Hook personalizzato per usare il contesto
export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Export dei tipi per riutilizzo
export type { Profile, UserContextType }