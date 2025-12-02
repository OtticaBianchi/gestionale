'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Lightbulb,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCcw,
  Eye,
  PenSquare,
  X,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Database } from '@/types/database.types';

type SuggestionStatus = 'pending' | 'in_review' | 'accepted' | 'rejected';
type StatusFilter = SuggestionStatus | 'open' | 'all';

type Suggestion = {
  id: string;
  procedure_id: string;
  title: string;
  description: string;
  suggested_by: string;
  created_at: string;
  status: SuggestionStatus;
  admin_notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  procedure?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  suggested_by_profile?: {
    id: string;
    full_name: string | null;
  } | null;
  handler?: {
    id: string;
    full_name: string | null;
  } | null;
};

const statusLabels: Record<SuggestionStatus, string> = {
  pending: 'Da gestire',
  in_review: 'In valutazione',
  accepted: 'Accettata',
  rejected: 'Respinta'
};

const statusClasses: Record<SuggestionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  in_review: 'bg-blue-100 text-blue-800 ring-blue-200',
  accepted: 'bg-green-100 text-green-800 ring-green-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200'
};

export default function ProcedureSuggestionsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          router.push('/procedure');
          return;
        }

        if (active) {
          setAuthorized(true);
        }
      } finally {
        if (active) {
          setCheckingAccess(false);
        }
      }
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!authorized) return;
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, statusFilter]);

  useEffect(() => {
    if (selectedSuggestion) {
      setNoteDraft(selectedSuggestion.admin_notes ?? '');
    }
  }, [selectedSuggestion]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`/api/procedure-suggestions?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Errore nel recupero delle proposte');
      }

      const result = await response.json();
      const normalized = (result.suggestions ?? []).map((item: any) => ({
        ...item,
        status: (item.status || 'pending') as SuggestionStatus
      }));

      setSuggestions(normalized);
    } catch (error) {
      console.error(error);
      toast.error('Impossibile caricare le proposte di modifica');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchSuggestions();
  };

  const handleUpdate = async (payload: Partial<Pick<Suggestion, 'status' | 'admin_notes'>>) => {
    if (!selectedSuggestion) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/procedure-suggestions/${selectedSuggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'aggiornamento');
      }

      const result = await response.json();
      const updated = {
        ...result.suggestion,
        status: (result.suggestion?.status || 'pending') as SuggestionStatus
      } as Suggestion;

      setSuggestions((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setSelectedSuggestion(updated);
      toast.success('Proposta aggiornata');
    } catch (error) {
      console.error(error);
      toast.error('Aggiornamento non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const openCount = useMemo(
    () => suggestions.filter((s) => s.status === 'pending' || s.status === 'in_review').length,
    [suggestions]
  );
  const acceptedCount = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted').length,
    [suggestions]
  );
  const rejectedCount = useMemo(
    () => suggestions.filter((s) => s.status === 'rejected').length,
    [suggestions]
  );

  const renderStatus = (status: SuggestionStatus) => (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ring-1 ${statusClasses[status]}`}>
      {status === 'accepted' && <CheckCircle2 className="h-4 w-4" />}
      {status === 'rejected' && <XCircle className="h-4 w-4" />}
      {status === 'pending' && <Clock3 className="h-4 w-4" />}
      {status === 'in_review' && <Eye className="h-4 w-4" />}
      {statusLabels[status]}
    </span>
  );

  const renderRow = (suggestion: Suggestion) => (
    <tr key={suggestion.id} className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{suggestion.title}</div>
        <div className="text-sm text-gray-500 line-clamp-1">{suggestion.description}</div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900">
          {suggestion.procedure?.title || 'Procedura'}
        </div>
        {suggestion.procedure?.slug && (
          <a
            href={`/procedure/${suggestion.procedure.slug}`}
            className="text-xs text-blue-600 hover:text-blue-700"
            target="_blank"
            rel="noreferrer"
          >
            Apri procedura
          </a>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-gray-700">
        {suggestion.suggested_by_profile?.full_name || 'Utente'}
      </td>
      <td className="px-6 py-4">
        {renderStatus(suggestion.status)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {new Date(suggestion.created_at).toLocaleString('it-IT')}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {suggestion.handler?.full_name || suggestion.handled_by ? suggestion.handler?.full_name || 'Gestita' : '—'}
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => setSelectedSuggestion(suggestion)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <PenSquare className="h-4 w-4" />
          Gestisci
        </button>
      </td>
    </tr>
  );

  const renderList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      );
    }

    if (!suggestions.length) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-600 font-medium">Nessuna proposta trovata</div>
          <div className="text-sm text-gray-500 mt-1">Prova a cambiare i filtri o a ricaricare.</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Proposta</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Procedura</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Proposta da</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Stato</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Creata</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Gestita da</th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-700">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {suggestions.map(renderRow)}
          </tbody>
        </table>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Proposte di modifica</h1>
            <p className="text-sm text-gray-600">Gestisci le richieste inviate dagli utenti sulle procedure.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca per titolo o descrizione..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-72 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
              <Search className="h-4 w-4" />
            </span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="open">Da gestire</option>
            <option value="all">Tutte</option>
            <option value="pending">In attesa</option>
            <option value="in_review">In valutazione</option>
            <option value="accepted">Accettate</option>
            <option value="rejected">Respinte</option>
          </select>
          <button
            onClick={handleSearch}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <RefreshCcw className="h-4 w-4" />
            Aggiorna
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500">Da gestire</div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-2xl font-semibold text-gray-900">{openCount}</div>
              <Clock3 className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500">Accettate</div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-2xl font-semibold text-gray-900">{acceptedCount}</div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500">Respinte</div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-2xl font-semibold text-gray-900">{rejectedCount}</div>
              <XCircle className="h-5 w-5 text-rose-500" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Proposte</h2>
              <p className="text-sm text-gray-600">Tutte le proposte di modifica alle procedure.</p>
            </div>
            <button
              onClick={fetchSuggestions}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Ricarica
            </button>
          </div>
          {renderList()}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {checkingAccess ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        content
      )}

      {selectedSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <div className="text-sm text-gray-500">Proposta</div>
                <div className="text-lg font-semibold text-gray-900">{selectedSuggestion.title}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedSuggestion.procedure?.title || 'Procedura'} · Inviata il{' '}
                  {new Date(selectedSuggestion.created_at).toLocaleString('it-IT')}
                </div>
              </div>
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase">Descrizione</div>
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">
                  {selectedSuggestion.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase">Proposta da</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedSuggestion.suggested_by_profile?.full_name || 'Utente'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase">Stato</div>
                  {renderStatus(selectedSuggestion.status)}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase">Gestita da</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedSuggestion.handler?.full_name || selectedSuggestion.handled_by ? selectedSuggestion.handler?.full_name || 'Gestita' : '—'}
                  </div>
                  {selectedSuggestion.handled_at && (
                    <div className="text-xs text-gray-500">
                      il {new Date(selectedSuggestion.handled_at).toLocaleString('it-IT')}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase">Procedura</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedSuggestion.procedure?.title || '—'}
                  </div>
                  {selectedSuggestion.procedure?.slug && (
                    <a
                      href={`/procedure/${selectedSuggestion.procedure.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Apri procedura
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-800">Note amministratore</div>
                <textarea
                  rows={4}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Aggiungi note o decisioni prese..."
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleUpdate({ admin_notes: noteDraft })}
                    disabled={saving}
                    className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Salva note
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-800">Aggiorna stato</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleUpdate({ status: 'pending', admin_notes: noteDraft })}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSuggestion.status === 'pending'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    In attesa
                  </button>
                  <button
                    onClick={() => handleUpdate({ status: 'in_review', admin_notes: noteDraft })}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSuggestion.status === 'in_review'
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    In valutazione
                  </button>
                  <button
                    onClick={() => handleUpdate({ status: 'accepted', admin_notes: noteDraft })}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSuggestion.status === 'accepted'
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-gray-200 hover:border-green-200 hover:bg-green-50'
                    }`}
                  >
                    Accetta
                  </button>
                  <button
                    onClick={() => handleUpdate({ status: 'rejected', admin_notes: noteDraft })}
                    disabled={saving}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSuggestion.status === 'rejected'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-gray-200 hover:border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
