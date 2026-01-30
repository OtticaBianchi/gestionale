'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Loader2,
  RefreshCcw,
  Users,
  ShieldCheck
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUser } from '@/context/UserContext';

type DedupClient = {
  id: string;
  nome: string | null;
  cognome: string | null;
  telefono: string | null;
  email: string | null;
  genere: string | null;
  data_nascita: string | null;
  note_cliente: string | null;
  created_at: string | null;
  updated_at: string | null;
  buste_count: number;
  error_tracking_count: number;
  voice_notes_count: number;
  has_links: boolean;
  is_empty: boolean;
  data_score: number;
  display_name: string;
};

type DedupGroup = {
  key: string;
  display_name: string;
  reasons: string[];
  auto_merge: {
    winner_id: string;
    loser_id: string;
    reason: string;
  } | null;
  clients: DedupClient[];
};

type DedupStats = {
  groups_total: number;
  auto_merge_groups: number;
  total_records: number;
};

type DedupResponse = {
  success: boolean;
  generated_at: string;
  stats: DedupStats;
  groups: DedupGroup[];
  error?: string;
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('it-IT');
};

const shortId = (value: string) => `${value.slice(0, 8)}…`;

const reasonLabel = (reason: string) => {
  switch (reason) {
    case 'contatto_coincidente':
      return 'Contatto coincidente';
    case 'record_vuoto':
      return 'Record vuoto';
    case 'nome_coincidente':
      return 'Nome/Cognome coincidenti';
    case 'nome_incompleto':
      return 'Nome/Cognome incompleti';
    default:
      return reason;
  }
};

export default function DedupClientiPage() {
  const router = useRouter();
  const { profile, isLoading } = useUser();
  const isAdmin = profile?.role === 'admin';

  const [groups, setGroups] = useState<DedupGroup[]>([]);
  const [stats, setStats] = useState<DedupStats | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/clienti/dedup', { cache: 'no-store' });
      const data = (await response.json()) as DedupResponse;
      if (!response.ok || !data.success) {
        setError(data.error || 'Errore durante il caricamento duplicati');
        return;
      }
      setGroups(data.groups ?? []);
      setStats(data.stats ?? null);
      setGeneratedAt(data.generated_at ?? null);
    } catch (err) {
      console.error('Errore fetch duplicati clienti:', err);
      setError('Errore durante il caricamento duplicati');
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
      void fetchGroups();
    }
  }, [fetchGroups, isAdmin]);

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
            <span>Non hai i permessi necessari per gestire i duplicati clienti.</span>
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
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Duplicati Clienti</h1>
                <p className="text-sm text-gray-500">
                  Analizza i duplicati e unisci i record in sicurezza (manuale salvo casi di record vuoti).
                </p>
              </div>
            </div>
            <button
              onClick={() => void fetchGroups()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Aggiorna lista
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

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Gruppi duplicati</span>
                  <Users className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{stats?.groups_total ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-600">Auto-merge disponibili</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats?.auto_merge_groups ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">Record coinvolti</span>
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{stats?.total_records ?? 0}</p>
                {generatedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Ultima scansione: {new Date(generatedAt).toLocaleString('it-IT')}
                  </p>
                )}
              </div>
            </section>

            {isFetching && groups.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div>
                    <p className="font-medium text-slate-800">Analisi duplicati in corso...</p>
                    <p className="text-sm text-slate-500">Stiamo raccogliendo i record dal database.</p>
                  </div>
                </div>
              </div>
            )}

            {!isFetching && groups.length === 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-emerald-700 shadow-sm">
                Nessun duplicato rilevato con le regole correnti.
              </div>
            )}

            {groups.map((group) => (
              <DedupGroupCard key={group.key} group={group} onMerged={fetchGroups} />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function DedupGroupCard({ group, onMerged }: { group: DedupGroup; onMerged: () => Promise<void> | void }) {
  const [winnerId, setWinnerId] = useState(() => {
    if (group.auto_merge) return group.auto_merge.winner_id;
    const sorted = [...group.clients].sort((a, b) => b.data_score - a.data_score);
    return sorted[0]?.id ?? '';
  });
  const [loserId, setLoserId] = useState(() => {
    if (group.auto_merge) return group.auto_merge.loser_id;
    const candidates = group.clients.filter((client) => client.buste_count === 0);
    const sorted = [...candidates].sort((a, b) => a.data_score - b.data_score);
    return sorted[0]?.id ?? '';
  });
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);

  const eligibleLosers = useMemo(
    () => group.clients.filter((client) => client.buste_count === 0 && client.id !== winnerId),
    [group.clients, winnerId]
  );

  useEffect(() => {
    if (!eligibleLosers.find((client) => client.id === loserId)) {
      setLoserId(eligibleLosers[0]?.id ?? '');
    }
  }, [eligibleLosers, loserId]);

  const handleMerge = useCallback(
    async (force: boolean, mode: 'manual' | 'auto') => {
      if (!winnerId || !loserId) return;
      const confirmText =
        mode === 'auto'
          ? 'Confermi il merge automatico dei duplicati?'
          : 'Confermi il merge manuale dei duplicati selezionati?';
      if (!window.confirm(confirmText)) {
        return;
      }
      setIsMerging(true);
      setMergeError(null);
      setConflicts(null);
      try {
        const response = await fetch('/api/admin/clienti/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            winner_id: winnerId,
            loser_id: loserId,
            mode,
            force
          })
        });

        const result = await response.json().catch(() => ({} as { error?: string; conflicts?: string[] }));

        if (!response.ok) {
          if (response.status === 409 && Array.isArray(result?.conflicts)) {
            setConflicts(result.conflicts);
            setMergeError('Conflitti sui dati. Puoi forzare il merge se sei sicuro.');
          } else {
            setMergeError(result?.error || 'Errore durante il merge');
          }
          return;
        }

        await onMerged();
      } catch (error) {
        console.error('Errore merge clienti:', error);
        setMergeError('Errore durante il merge');
      } finally {
        setIsMerging(false);
      }
    },
    [loserId, onMerged, winnerId]
  );

  const autoMergeAvailable = Boolean(group.auto_merge);
  const canManualMerge = Boolean(winnerId && loserId && eligibleLosers.length > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{group.display_name}</h3>
            {autoMergeAvailable && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Auto-merge disponibile
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {group.clients.length} record ·{' '}
            {group.reasons.map((reason) => reasonLabel(reason)).join(', ') || 'Verifica manuale'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {group.clients.map((client) => (
          <div key={client.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{client.display_name}</p>
                <p className="text-xs text-slate-500">ID: {shortId(client.id)}</p>
              </div>
              {client.buste_count > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                  {client.buste_count} busta/e
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  Nessuna busta
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600">
              <span>Telefono: {client.telefono || '—'}</span>
              <span>Email: {client.email || '—'}</span>
              <span>Genere: {client.genere || '—'}</span>
              <span>Data nascita: {formatDate(client.data_nascita)}</span>
              <span>Note: {client.note_cliente ? 'presenti' : '—'}</span>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Errori: {client.error_tracking_count} · Voice notes: {client.voice_notes_count}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Creato: {formatDate(client.created_at)} · Aggiornato: {formatDate(client.updated_at)}
            </div>
            {client.is_empty && (
              <div className="mt-2 rounded-md bg-slate-200/60 px-2 py-1 text-[11px] font-medium text-slate-600">
                Record con soli nome/cognome
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <GitMerge className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Merge record</span>
        </div>

        {mergeError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {mergeError}
          </div>
        )}

        {conflicts && conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Conflitti rilevati: {conflicts.join(', ')}.
          </div>
        )}

        {autoMergeAvailable ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void handleMerge(false, 'auto')}
              disabled={isMerging}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              Applica auto-merge
            </button>
            <span className="text-xs text-slate-500">
              Record vuoto verrà unito a quello con dati completi.
            </span>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs text-slate-600">
                Record da conservare
                <select
                  value={winnerId}
                  onChange={(event) => setWinnerId(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {group.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.display_name} {client.buste_count > 0 ? '(ha buste)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs text-slate-600">
                Record da eliminare
                <select
                  value={loserId}
                  onChange={(event) => setLoserId(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {eligibleLosers.length === 0 && <option value="">Nessun record eliminabile</option>}
                  {eligibleLosers.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void handleMerge(false, 'manual')}
                disabled={isMerging || !canManualMerge}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                <GitMerge className="h-4 w-4" />
                Esegui merge
              </button>
              {conflicts && conflicts.length > 0 && (
                <button
                  onClick={() => void handleMerge(true, 'manual')}
                  disabled={isMerging}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-200 disabled:opacity-60"
                >
                  Forza merge
                </button>
              )}
              {!canManualMerge && (
                <span className="text-xs text-slate-500">
                  Nessun record eliminabile (buste collegate).
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
