// app/dashboard/_components/UserProfileHeader.tsx
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { User, LogOut, Settings, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Profile = Database['public']['Tables']['profiles']['Row'];

// ✅ FIX: Create supabase client outside component to prevent recreations
const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UserProfileHeader() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    // ✅ INTEGRAZIONE: TUO pattern isMounted + BUSINESS LOGIC esistente
    let isMounted = true;
    
    // ✅ FIX: Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('⏱️ Profile loading timeout - redirecting to login');
        setError('Timeout caricamento profilo');
        router.push('/login');
      }
    }, 10000); // 10 seconds timeout
    
    const getProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // ✅ EXISTING LOGIC: Authentication check
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!isMounted) return; // ✅ TUO PATTERN: Early return se unmounted
        
        if (userError) {
          console.error('❌ Error getting user:', userError);
          setError('Errore di autenticazione');
          return;
        }

        if (!user) {
          console.log('❌ No user found, redirecting to login');
          router.push('/login');
          return;
        }

        setUser(user);

        // ✅ EXISTING LOGIC: Get profile with your single() fix
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(); // ✅ TUO FIX: Ensure single row

        if (!isMounted) return; // ✅ TUO PATTERN: Check mount status

        if (profileError) {
          console.error('❌ Error getting profile:', profileError);
          
          // ✅ EXISTING LOGIC: Create missing profile
          if (profileError.code === 'PGRST116') {
            console.log('📝 Creating missing profile...');
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                full_name: user.email?.split('@')[0] || 'Utente',
                role: 'user'
              })
              .select()
              .single();

            if (!isMounted) return; // ✅ TUO PATTERN: Check after async

            if (createError) {
              console.error('❌ Error creating profile:', createError);
              setError('Errore creazione profilo');
            } else {
              setProfile(newProfile);
            }
          } else {
            setError('Errore caricamento profilo');
          }
        } else {
          setProfile(profile);
        }

      } catch (error) {
        console.error('❌ Error in getProfile:', error);
        if (isMounted) {
          setError('Errore imprevisto');
        }
      } finally {
        // ✅ TUO PATTERN: Protected finally block
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(timeoutId); // Clear timeout on successful load
        }
      }
    };

    getProfile();

    // ✅ EXISTING LOGIC: Auth state listener con TUO cleanup pattern
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 Auth state changed:', event, session?.user?.email);
        
        if (!isMounted) return; // ✅ TUO PATTERN: Check mount status
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          router.push('/login');
        } else if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          // Don't re-fetch profile - let the initial load handle it
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Handle token refresh - just log, don't re-fetch
          console.log('🔄 Token refreshed for user:', session.user.email);
        }
      }
    );

    // ✅ TUO PATTERN: Cleanup function with subscription cleanup
    return () => {
      isMounted = false;
      clearTimeout(timeoutId); // Clear timeout on unmount
      subscription.unsubscribe();
    };
  }, []); // ✅ FIX: Remove supabase dependency to prevent infinite loop

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      console.log('🔍 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error);
        alert('Errore durante il logout');
      } else {
        console.log('✅ Signed out successfully');
        // Auth state listener will handle the redirect
      }
    } catch (error) {
      console.error('❌ Unexpected error during sign out:', error);
      alert('Errore imprevisto durante il logout');
    } finally {
      setIsSigningOut(false);
    }
  };

  // ✅ EXISTING LOGIC: Loading state
  if (isLoading) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-gray-900">Ottica Bianchi</h1>
            <span className="text-sm text-gray-500">Gestionale</span>
          </div>
          
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Caricamento profilo...</span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ IMPROVED: Better error/logout state messaging
  if (error || !user) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-gray-900">Ottica Bianchi</h1>
            <span className="text-sm text-gray-500">Gestionale</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2 text-orange-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Tempo di inattività superiore ai 5 minuti - Logout automatico
                </span>
              </div>
            </div>
            
            <button
              onClick={() => window.location.href = '/login'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="text-sm">Accedi di nuovo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Logo e Titolo */}
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-bold text-gray-900">Ottica Bianchi</h1>
          <span className="text-sm text-gray-500">Gestionale</span>
        </div>

        {/* Profilo Utente */}
        <div className="flex items-center space-x-4">
          {/* Info Utente */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.full_name || user.email?.split('@')[0] || 'Utente'}
              </p>
              <p className="text-xs text-gray-500">
                {user.email}
              </p>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                // ✅ EXISTING LOGIC: Navigate to settings (will create page later)
                alert('Pagina impostazioni in costruzione');
                // router.push('/settings'); // Will work once we create the page
              }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Impostazioni"
            >
              <Settings className="h-4 w-4" />
            </button>
            
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              title="Logout"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>Esci</span>
            </button>
          </div>
        </div>
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-400 border-t pt-2">
          User ID: {user.id.slice(0, 8)}... | Role: {profile?.role || 'N/A'} | 
          Profile: {profile ? '✅' : '❌'} |
          Last sign in: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleTimeString('it-IT') : 'N/A'}
        </div>
      )}
    </div>
  );
}