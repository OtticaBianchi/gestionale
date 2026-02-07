'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUser } from '@/context/UserContext';

type CandidateClient = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

type SurveyMatchQueueItem = {
  match_id: string;
  survey_response_id: string;
  match_confidence: 'high' | 'medium' | 'low' | 'none';
  match_strategy: string;
  similarity_score: number | null;
  candidate_client_ids: string[];
  candidate_clients: CandidateClient[];
  needs_review: boolean;
  match_notes: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  overall_score: number | null;
  badge_level: string | null;
  submitted_at: string | null;
  response_created_at: string;
};

type QueueResponse = {
  success: boolean;
  data: SurveyMatchQueueItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
};

const confidenceBadgeClass: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-amber-100 text-amber-700',
  none: 'bg-rose-100 text-rose-700'
};

const badgeClass: Record<string, string> = {
  eccellente: 'bg-emerald-100 text-emerald-700',
  positivo: 'bg-blue-100 text-blue-700',
  attenzione: 'bg-amber-100 text-amber-700',
  critico: 'bg-rose-100 text-rose-700'
};

export default function SurveyMatchesAdminPage() {
  const router = useRouter();
  const { profile, isLoading } = useUser();
  const isAdmin = profile?.role === 'admin';

  const [items, setItems] = useState<SurveyMatchQueueItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/survey-matches?needs_review=true&limit=100', { cache: 'no-store' });
      const payload = (await response.json()) as QueueResponse;
      if (!response.ok || !payload.success) {
        setError(payload.error || 'Errore caricamento coda match survey');
        return;
      }
      setItems(payload.data || []);
    } catch (err) {
      console.error('Errore fetch survey match queue:', err);
      setError('Errore caricamento coda match survey');
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isLoading && profile && !isAdmin) {
      router.replace('/dashboard?error=admin_required');
    }
  }, [isAdmin, isLoading, profile, router]);

  useEffect(() => {
    if (isAdmin) {
      void fetchQueue();
    }
  }, [fetchQueue, isAdmin]);

  const resolveMatch = async (matchId: string, payload: { approve?: boolean; cliente_id?: string | null; notes?: string | null }) => {
    setSavingMatchId(matchId);
    try {
      const response = await fetch(`/api/admin/survey-matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success !== true) {
        alert(data?.error || 'Errore aggiornamento match');
        return;
      }
      await fetchQueue();
    } catch (err) {
      console.error('Errore update match survey:', err);
      alert('Errore aggiornamento match');
    } finally {
      setSavingMatchId(null);
    }
  };

  if (isLoading || (profile && !isAdmin)) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center bg-gray-50">
          <div className="flex items-center gap-3 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Caricamento dati profilo...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center bg-gray-50">
          <div className="text-center text-gray-600">
            <p className="font-medium">Sessione non trovata.</p>
            <p className="text-sm text-gray-500 mt-1">Accedi nuovamente per procedere.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center bg-gray-50">
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <span>Non hai i permessi necessari.</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col bg-gray-50">
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 p-3 text-white shadow-lg">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Revisione Match Survey</h1>
                <p className="text-sm text-gray-500">
                  Conferma manualmente i match a bassa confidenza o ambigui.
                </p>
              </div>
            </div>
            <button
              onClick={() => void fetchQueue()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Aggiorna coda
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Elementi in coda</p>
                <p className="text-2xl font-semibold text-slate-900">{items.length}</p>
              </div>
            </section>

            {isFetching && items.length === 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Caricamento queue...</span>
                </div>
              </section>
            )}

            {!isFetching && items.length === 0 && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 shadow-sm text-emerald-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Nessun match in revisione. Ottimo.</span>
                </div>
              </section>
            )}

            {items.map((item) => (
              <section key={item.match_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {item.respondent_name || 'Senza nome'}
                  </span>
                  <span className="text-sm text-slate-500">{item.respondent_email || 'Senza email'}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${confidenceBadgeClass[item.match_confidence] || confidenceBadgeClass.none}`}>
                    {item.match_confidence}
                  </span>
                  {item.badge_level && (
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeClass[item.badge_level] || badgeClass.attenzione}`}>
                      {item.badge_level}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    Score: {typeof item.overall_score === 'number' ? item.overall_score.toFixed(2) : '—'}
                  </span>
                  {typeof item.similarity_score === 'number' && (
                    <span className="text-xs text-slate-500">Similarity: {item.similarity_score.toFixed(2)}</span>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Strategia: {item.match_strategy} · Ricevuta: {new Date(item.response_created_at).toLocaleString('it-IT')}
                </p>

                {item.match_notes && (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-100">
                    {item.match_notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.candidate_clients && item.candidate_clients.length > 0 ? (
                    item.candidate_clients.map((candidate) => (
                      <button
                        key={candidate.id}
                        disabled={savingMatchId === item.match_id}
                        onClick={() => void resolveMatch(item.match_id, { approve: true, cliente_id: candidate.id })}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Associa a {candidate.cognome || ''} {candidate.nome || ''} ({candidate.email || 'no-email'})
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Nessun candidato suggerito.</p>
                  )}
                </div>

                <div className="mt-3">
                  <button
                    disabled={savingMatchId === item.match_id}
                    onClick={() => void resolveMatch(item.match_id, { approve: false })}
                    className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Segna come non associabile
                  </button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
