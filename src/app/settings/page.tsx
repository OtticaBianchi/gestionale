// app/settings/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import Link from 'next/link';
import { ArrowLeft, User, Shield, Bell, Palette, Download, HelpCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = cookies();
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component limitation
          }
        },
      },
    }
  );

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Accesso Richiesto</h1>
          <p className="text-gray-600 mb-6">Devi essere autenticato per accedere alle impostazioni.</p>
          <Link 
            href="/login" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Vai al Login
          </Link>
        </div>
      </div>
    );
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Torna alla Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          
          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Profilo Utente</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Modifica disponibile prossimamente</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={user.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email di accesso</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                <input
                  type="text"
                  value={profile?.role || 'user'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  disabled
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ultimo Accesso</label>
                <input
                  type="text"
                  value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('it-IT') : 'N/A'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Settings Sections - Coming Soon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Security */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Sicurezza</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Cambia password</li>
                <li>• Autenticazione a due fattori</li>
                <li>• Sessioni attive</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">Prossimamente...</p>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
              <div className="flex items-center space-x-3 mb-4">
                <Bell className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Notifiche</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Email notifications</li>
                <li>• Push notifications</li>
                <li>• Reminder settings</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">Prossimamente...</p>
            </div>

            {/* Appearance */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
              <div className="flex items-center space-x-3 mb-4">
                <Palette className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Aspetto</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Tema scuro/chiaro</li>
                <li>• Dimensione font</li>
                <li>• Colori dashboard</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">Prossimamente...</p>
            </div>

            {/* Data & Export */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
              <div className="flex items-center space-x-3 mb-4">
                <Download className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Dati & Export</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Esporta dati</li>
                <li>• Backup automatico</li>
                <li>• Cancellazione account</li>
              </ul>
              <p className="text-xs text-gray-500 mt-4 italic">Prossimamente...</p>
            </div>
          </div>

          {/* Help & Support */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">Supporto</h3>
            </div>
            <p className="text-blue-800 text-sm mb-4">
              Hai bisogno di aiuto? La pagina impostazioni è attualmente in sviluppo.
            </p>
            <div className="flex space-x-4">
              <Link
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                Torna alla Dashboard
              </Link>
              <button
                onClick={() => alert('Sistema di supporto in sviluppo')}
                className="bg-white text-blue-600 border border-blue-300 px-4 py-2 rounded-md text-sm hover:bg-blue-50"
              >
                Contatta Supporto
              </button>
            </div>
          </div>

          {/* Version Info */}
          <div className="text-center text-xs text-gray-500 py-4">
            Gestionale Ottica Bianchi v1.0.0 | Build: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>
      </div>
    </div>
  );
}