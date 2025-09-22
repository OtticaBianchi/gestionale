// app/dashboard/buste/new/_components/NewBustaClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import MultiStepBustaForm from '@/app/dashboard/_components/MultiStepBustaForm';
import SessionManager from '@/components/SessionManager';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NewBustaClient() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ✅ Verifica autenticazione all'avvio
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error('Auth error:', error);
          setAuthError('Errore di autenticazione');
          setIsAuthenticated(false);
          return;
        }

        if (!user) {
          setAuthError('Sessione scaduta');
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error checking auth:', error);
        setAuthError('Errore di connessione');
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    // No need for auth listener - UserContext handles this
    // Removed duplicate auth listener to prevent session conflicts
  }, []);

  // ✅ Gestisci annullamento
  const handleCancel = () => {
    router.push('/dashboard');
  };

  // ✅ Gestisci successo creazione
  const handleSuccess = () => {
    router.push('/dashboard');
  };

  // ✅ Gestisci riaccesso
  const handleReLogin = () => {
    router.push('/login');
  };

  // ✅ Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifica autenticazione...</p>
        </div>
      </div>
    );
  }

  // ✅ Errore di autenticazione
  if (!isAuthenticated || authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Accesso Richiesto
              </h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                {authError || 'È necessario effettuare il login per creare una nuova busta.'}
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleReLogin}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Accedi
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Interfaccia principale
  return (
    <>
      {/* ✅ SessionManager per gestire timeout */}
      <SessionManager />
      
      <div className="min-h-screen bg-gray-50">
        {/* ✅ Header con pulsante torna indietro */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                  title="Torna alla Dashboard"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Dashboard</span>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Crea Nuova Busta
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Contenuto principale */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="mb-6">
            <p className="text-sm text-gray-500">
              Inserisci i dettagli della nuova lavorazione. I campi obbligatori sono segnati con *.
            </p>
          </div>
          
          <main>
            <MultiStepBustaForm 
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </main>
        </div>
      </div>
    </>
  );
}
