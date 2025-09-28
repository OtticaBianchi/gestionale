// app/dashboard/_components/UserProfileHeader.tsx
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { User, LogOut, Settings, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';

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
  const { signOut: signOutWithContext } = useUser();

  useEffect(() => {
    // ✅ INTEGRAZIONE: TUO pattern isMounted + BUSINESS LOGIC esistente
    let isMounted = true;
    
    // Rende il componente resiliente: niente redirect automatico; mostra errore e consente retry
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('⏱️ Profile loading timeout');
        setError('Timeout caricamento profilo');
      }
    }, 15000);
    
    // Authentication function - handles user authentication check
    const authenticateUser = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('❌ Error getting user:', userError);
        throw new Error('Errore di autenticazione');
      }

      if (!user) {
        console.log('❌ No user found, showing error state');
        throw new Error('Utente non autenticato');
      }

      return user;
    };

    // Profile fetching function - gets existing profile from database
    const fetchUserProfile = async (userId: string) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Error getting profile:', profileError);
        throw new Error('Errore caricamento profilo');
      }

      return { profile, error: profileError };
    };

    // Profile creation function - creates new profile when missing
    const createUserProfile = async (user: any) => {
      console.log('📝 Creating missing profile...');

      // Prefer role and full_name from user metadata if present (invited users)
      const invitedRole = (user.user_metadata as any)?.role || 'operatore';
      const invitedName = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Utente';

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: invitedName,
          role: invitedRole
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile:', createError);
        throw new Error('Errore creazione profilo');
      }

      return newProfile;
    };

    // Role synchronization function - syncs role from metadata
    const syncProfileRole = async (user: any, profile: Profile) => {
      const metaRole = (user.user_metadata as any)?.role as string | undefined;
      const allowed = new Set(['admin', 'manager', 'operatore']);

      if (!metaRole || !allowed.has(metaRole) || profile.role === metaRole) {
        return profile;
      }

      console.log('🔄 Syncing profile role from metadata:', profile.role, '->', metaRole);

      const { data: synced, error: syncErr } = await supabase
        .from('profiles')
        .update({ role: metaRole, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*')
        .single();

      if (syncErr) {
        console.warn('⚠️ Role sync failed (non-blocking):', syncErr);
        return profile;
      }

      return synced;
    };

    // Main orchestrator function - coordinates all profile operations
    const getProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Step 1: Authenticate user
        const user = await authenticateUser();
        if (!isMounted) return;

        setUser(user);

        // Step 2: Fetch existing profile
        const { profile, error: profileError } = await fetchUserProfile(user.id);
        if (!isMounted) return;

        let finalProfile: Profile;

        // Step 3: Handle missing profile by creating it
        if (profileError?.code === 'PGRST116') {
          finalProfile = await createUserProfile(user);
          if (!isMounted) return;
        } else if (profile) {
          // Step 4: Sync role from metadata if needed
          finalProfile = await syncProfileRole(user, profile);
          if (!isMounted) return;
        } else {
          throw new Error('Profilo non disponibile');
        }

        setProfile(finalProfile);

      } catch (error) {
        console.error('❌ Error in getProfile:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Errore imprevisto');
        }
      } finally {
        // Protected finally block
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    getProfile();

    // Removed duplicate auth listener - UserContext handles all auth state changes
    // This prevents session conflicts when multiple users are working

    // ✅ Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timeoutId); // Clear timeout on unmount
    };
  }, []); // ✅ FIX: Remove supabase dependency to prevent infinite loop

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      console.log('🔍 Signing out...');
      await signOutWithContext('manual');
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      alert('Errore durante il logout');
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
            <h1 className="text-lg font-bold text-gray-900">OB Moduli</h1>
            <span className="text-sm text-gray-500">v2.8</span>
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
            <h1 className="text-lg font-bold text-gray-900">OB Moduli</h1>
            <span className="text-sm text-gray-500">v2.8</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {error && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2 text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {error}. Riprova o torna al login.
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.refresh()}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Riprova
              </button>
              <a href="/login" className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Accedi di nuovo
              </a>
            </div>
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
          <h1 className="text-lg font-bold text-gray-900">OB Moduli</h1>
          <span className="text-sm text-gray-500">v2.8</span>
        </div>

        {/* Profilo Utente */}
        <div className="flex items-center space-x-4">
          {/* Info Utente */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.src.includes('ui-avatars.com')) {
                      img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=random&size=32`;
                    }
                  }}
                />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
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
                router.push('/profile');
              }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Profilo Utente"
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
