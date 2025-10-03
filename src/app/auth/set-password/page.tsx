'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { Loader2, Lock } from 'lucide-react';

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri');
      return;
    }
    if (password !== confirm) {
      setError('Le password non coincidono');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.location.replace('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Errore impostazione password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-6 rounded-md shadow border border-gray-200 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Imposta Password</h1>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          La password deve contenere almeno 8 caratteri con lettere maiuscole, minuscole, numeri e caratteri speciali. Esempio: <span className="font-mono text-gray-800">Ott.Bia62</span>
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="new-password" className="block text-sm text-gray-700 mb-1">Nuova password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Almeno 8 caratteri"
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm text-gray-700 mb-1">Conferma password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
              minLength={8}
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-md py-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Salvataggio...' : 'Salva Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

