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

  const themeShell = (
    <style jsx global>{`
      :root {
        --paper: #f6f1e9;
        --ink: #1b1f24;
        --teal: #0f6a6e;
        --copper: #b2734b;
      }
      .kiasma-hero {
        font-family: "DM Serif Display", "Iowan Old Style", "Times New Roman", serif;
      }
      .kiasma-body {
        font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
      }
    `}</style>
  );

  const backgroundLayer = (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,106,110,0.16),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(178,115,75,0.16),transparent_45%),radial-gradient(circle_at_60%_80%,rgba(15,106,110,0.1),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(120deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />
    </>
  );

  // ✅ Loading state
  if (isAuthenticated === null) {
    return (
      <div className="relative min-h-screen bg-[var(--paper)] text-slate-900 kiasma-body flex items-center justify-center overflow-hidden">
        {themeShell}
        {backgroundLayer}
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--teal)] mx-auto mb-4"></div>
          <p className="text-slate-600">Verifica autenticazione...</p>
        </div>
      </div>
    );
  }

  // ✅ Errore di autenticazione
  if (!isAuthenticated || authError) {
    return (
      <div className="relative min-h-screen bg-[var(--paper)] text-slate-900 kiasma-body flex items-center justify-center overflow-hidden">
        {themeShell}
        {backgroundLayer}
        <div className="relative z-10 max-w-md w-full mx-4">
          <div className="rounded-[24px] border border-slate-200 bg-white/90 p-6 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="kiasma-hero text-lg text-[var(--ink)]">
                Accesso richiesto
              </h2>
            </div>
            
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                {authError || 'È necessario effettuare il login per creare una nuova busta.'}
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleReLogin}
                  className="flex-1 rounded-lg bg-[var(--ink)] px-4 py-2 text-[var(--paper)] hover:bg-black transition-colors"
                >
                  Accedi
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
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
      
      <div className="relative min-h-screen bg-[var(--paper)] text-slate-900 kiasma-body overflow-hidden">
        {themeShell}
        {backgroundLayer}
        {/* ✅ Header con pulsante torna indietro */}
        <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
                  title="Torna alla Dashboard"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Dashboard</span>
                </button>
                <div className="h-6 w-px bg-slate-300"></div>
                <h1 className="kiasma-hero text-xl text-[var(--ink)]">
                  Crea Nuova Busta
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Contenuto principale */}
        <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="mb-6">
            <p className="text-sm text-slate-600">
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
