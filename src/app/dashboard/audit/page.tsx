'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Filter, RefreshCw, Search, CalendarClock, Info, UserCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUser } from '@/context/UserContext';

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string | null;
  user_role: string | null;
  reason: string | null;
  changed_fields: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  profilo?: {
    full_name: string | null;
  } | null;
};

type AuditUserOption = {
  id: string;
  full_name: string | null;
  role: string | null;
};

const TABLE_OPTIONS = [
  { value: '', label: 'Tutte le tabelle' },
  { value: 'buste', label: 'Buste' },
  { value: 'clienti', label: 'Clienti' },
  { value: 'ordini_materiali', label: 'Ordini Materiali' },
  { value: 'status_history', label: 'Storico Stati' },
  { value: 'follow_up_chiamate', label: 'Follow-up' },
  { value: 'voice_notes', label: 'Note Vocali' },
  { value: 'error_tracking', label: 'Errori' },
  { value: 'comunicazioni', label: 'Comunicazioni' },
  { value: 'info_pagamenti', label: 'Pagamenti' }
];

const ACTION_OPTIONS: Array<{ value: '' | 'INSERT' | 'UPDATE' | 'DELETE'; label: string }> = [
  { value: '', label: 'Tutte le azioni' },
  { value: 'INSERT', label: 'Inserimenti' },
  { value: 'UPDATE', label: 'Aggiornamenti' },
  { value: 'DELETE', label: 'Eliminazioni' }
];

const LIMIT_OPTIONS = [25, 50, 100, 150, 200];

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'short',
  timeStyle: 'medium'
});

const actionLabel = (action: AuditEntry['action']) => {
  switch (action) {
    case 'INSERT':
      return 'Inserimento';
    case 'UPDATE':
      return 'Aggiornamento';
    case 'DELETE':
      return 'Eliminazione';
    default:
      return action;
  }
};

const actionColor = (action: AuditEntry['action']) => {
  switch (action) {
    case 'INSERT':
      return 'bg-emerald-100 text-emerald-700';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-700';
    case 'DELETE':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getReadableLabel = (entry: AuditEntry) => {
  const metadata = entry.metadata ?? {};
  const busta = typeof (metadata as any)?.bustaReadableId === 'string' ? (metadata as any).bustaReadableId : null;
  const recordLabel = typeof (metadata as any)?.recordLabel === 'string' ? (metadata as any).recordLabel : null;
  return busta || recordLabel || entry.record_id || 'Record sconosciuto';
};

const getClienteLabel = (entry: AuditEntry) => {
  const metadata = entry.metadata ?? {};
  if (typeof (metadata as any)?.cliente === 'string') return (metadata as any).cliente as string;
  if (typeof (metadata as any)?.cliente_nome === 'string') return (metadata as any).cliente_nome as string;
  return null;
};

function AuditContent() {
  const { profile, isLoading } = useUser();
  const router = useRouter();

  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const [filters, setFilters] = useState({
    table: '',
    action: '',
    recordId: '',
    userId: '',
    source: '',
    from: '',
    to: '',
    search: ''
  });
  const [userOptions, setUserOptions] = useState<AuditUserOption[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'admin') {
      router.replace('/dashboard?error=admin_required');
    }
  }, [profile, isLoading, router]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    let active = true;
    setUsersError(null);
    fetch('/api/audit-logs/users', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Impossibile caricare gli utenti');
        }
        return res.json();
      })
      .then((payload) => {
        if (!active) return;
        setUserOptions(payload.data ?? []);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Errore caricamento utenti audit:', error);
        setUsersError('Non è stato possibile caricare l’elenco operatori');
        setUserOptions([]);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const canAccess = profile?.role === 'admin';

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', (page * limit).toString());

    if (filters.table) params.set('table', filters.table);
    if (filters.action) params.set('action', filters.action);
    if (filters.recordId) params.set('recordId', filters.recordId.trim());
    if (filters.userId) params.set('userId', filters.userId.trim());
    if (filters.source) params.set('source', filters.source.trim());
    if (filters.search) params.set('q', filters.search.trim());

    if (filters.from) {
      params.set('from', new Date(filters.from).toISOString());
    }
    if (filters.to) {
      params.set('to', new Date(filters.to).toISOString());
    }

    return params.toString();
  }, [filters, limit, page]);

  const fetchEntries = useCallback(async () => {
    if (!canAccess) return;
    setIsFetching(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/audit-logs?${queryString}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(payload.error || 'Errore nel recupero dei log');
      }

      const payload = await response.json();
      setEntries(payload.data ?? []);
      setTotalCount(payload.count ?? 0);
      setLastUpdated(new Date().toISOString());
    } catch (error: any) {
      console.error('Errore caricamento audit:', error);
      setErrorMessage(error.message || 'Errore inatteso durante il caricamento');
      setEntries([]);
      setTotalCount(0);
    } finally {
      setIsFetching(false);
    }
  }, [canAccess, queryString]);

  useEffect(() => {
    if (canAccess) {
      void fetchEntries();
    }
  }, [canAccess, fetchEntries]);

  const handleFiltersSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
  };

  const handleResetFilters = () => {
    setFilters({
      table: '',
      action: '',
      recordId: '',
      userId: '',
      source: '',
      from: '',
      to: '',
      search: ''
    });
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const showingFrom = totalCount === 0 ? 0 : page * limit + 1;
  const showingTo = Math.min(totalCount, (page + 1) * limit);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500 text-sm">Caricamento profilo...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="bg-white border border-red-100 rounded-lg p-6 text-center max-w-md">
          <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Accesso negato</h1>
          <p className="text-gray-600">
            Solo gli amministratori possono consultare il registro Audit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-6 space-y-6">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Controllo</p>
          <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Audit</h1>
              <p className="text-gray-600 mt-1">
                Registro completo delle modifiche eseguite dagli operatori e dai sistemi automatici.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void fetchEntries()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Aggiorna
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleFiltersSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter className="h-4 w-4" />
            <h2 className="font-semibold text-base">Filtri</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Tabella
              <select
                value={filters.table}
                onChange={(e) => setFilters((prev) => ({ ...prev, table: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TABLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Azione
              <select
                value={filters.action}
                onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Busta / Record
              <input
                type="text"
                value={filters.recordId}
                onChange={(e) => setFilters((prev) => ({ ...prev, recordId: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ID leggibile, cliente o UUID"
              />
              <span className="text-xs text-gray-500">
                Inserisci l’ID leggibile (es. B24-015), l’ID interno o il nome cliente presente nei campi audit.
              </span>
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Operatore
              <select
                value={filters.userId}
                onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutti gli operatori</option>
                {userOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.full_name ?? 'Senza nome'} {option.role ? `(${option.role})` : ''}
                  </option>
                ))}
              </select>
              {usersError && (
                <span className="text-xs text-red-500">{usersError}</span>
              )}
            </label>

            <label className="text-sm text-gray-500 italic flex flex-col gap-1">
              Origine tecnica (opzionale)
              <input
                type="text"
                value={filters.source}
                onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="es. api/buste/update-status"
              />
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Ricerca libera (cliente, note, motivazione)
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  placeholder="Record, motivazione, note..."
                />
              </div>
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              Da
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="text-sm text-gray-700 flex flex-col gap-1">
              A
              <input
                type="datetime-local"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 flex items-center gap-2">
                Righe per pagina
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(0);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <CalendarClock className="h-4 w-4" />
                {lastUpdated ? `Aggiornato alle ${dateFormatter.format(new Date(lastUpdated))}` : 'In attesa...'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Reimposta
              </button>
              <button
                type="submit"
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Applica filtri
              </button>
            </div>
          </div>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-sm text-gray-600 flex-wrap gap-2">
            <div>
              {totalCount === 0
                ? 'Nessun evento registrato'
                : `Mostrati ${showingFrom}-${showingTo} su ${totalCount} record`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0 || isFetching}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs uppercase tracking-wide text-gray-600 disabled:opacity-50"
              >
                Precedente
              </button>
              <span className="text-xs text-gray-500">Pagina {totalCount === 0 ? 0 : page + 1} di {totalPages}</span>
              <button
                onClick={() => setPage((prev) => (showingTo >= totalCount ? prev : prev + 1))}
                disabled={showingTo >= totalCount || isFetching}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs uppercase tracking-wide text-gray-600 disabled:opacity-50"
              >
                Successiva
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 border-b border-red-100 bg-red-50 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Tabella</th>
                  <th className="px-4 py-2 text-left font-medium">Azione</th>
                  <th className="px-4 py-2 text-left font-medium">Elemento</th>
                  <th className="px-4 py-2 text-left font-medium">Operatore</th>
                  <th className="px-4 py-2 text-left font-medium">Origine</th>
                  <th className="px-4 py-2 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isFetching && entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      Caricamento audit in corso...
                    </td>
                  </tr>
                )}

                {!isFetching && entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      Nessuna voce corrisponde ai filtri selezionati.
                    </td>
                  </tr>
                )}

                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                      {dateFormatter.format(new Date(entry.created_at))}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.table_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${actionColor(entry.action)}`}>
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {getReadableLabel(entry)}
                        </span>
                        {getClienteLabel(entry) && (
                          <span className="text-xs text-gray-500">{getClienteLabel(entry)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.user_id ? (
                        <span className="inline-flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4 text-gray-500" />
                          <span>
                            {entry.profilo?.full_name ?? entry.user_id.slice(0, 8)}
                            {entry.user_role && (
                              <span className="ml-1 text-xs text-gray-500">
                                ({entry.user_role})
                              </span>
                            )}
                          </span>
                        </span>
                      ) : (
                        'Sistema'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {typeof entry.metadata?.source === 'string' ? entry.metadata.source : 'N/D'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Dettagli
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedEntry && (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4 py-6"
            onClick={() => setSelectedEntry(null)}
          >
            <div
              className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Evento Audit</p>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-500" />
                    {selectedEntry.table_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {getReadableLabel(selectedEntry)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Chiudi
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-500 uppercase">Data</p>
                  <p className="text-gray-900 mt-1">{dateFormatter.format(new Date(selectedEntry.created_at))}</p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-500 uppercase">Operatore</p>
                  <p className="text-gray-900 mt-1">
                    {selectedEntry.user_id ? (
                      <>
                        {selectedEntry.profilo?.full_name ?? selectedEntry.user_id}
                        {selectedEntry.user_role && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({selectedEntry.user_role})
                          </span>
                        )}
                      </>
                    ) : (
                      'Sistema'
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-500 uppercase">Origine tecnica</p>
                  <p className="text-gray-900 mt-1">
                    {typeof selectedEntry.metadata?.source === 'string' ? selectedEntry.metadata.source : 'N/D'}
                  </p>
                </div>
              </div>

              {selectedEntry.reason && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 uppercase">Motivazione</p>
                  <p className="mt-1 text-gray-900 bg-gray-50 border border-gray-100 rounded-md p-3">
                    {selectedEntry.reason}
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Campi modificati</p>
                  {selectedEntry.changed_fields ? (
                    <ul className="space-y-2 text-sm">
                      {Object.entries(selectedEntry.changed_fields).map(([field, values]) => (
                        <li key={field} className="bg-gray-50 rounded-md p-2">
                          <p className="font-medium text-gray-900">{field}</p>
                          <p className="text-xs text-gray-500 mt-1">Da</p>
                          <p className="text-gray-800 text-sm">{formatValue((values as any)?.old)}</p>
                          <p className="text-xs text-gray-500 mt-1">A</p>
                          <p className="text-gray-800 text-sm">{formatValue((values as any)?.new)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">Nessun dettaglio disponibile.</p>
                  )}
                </div>

                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Metadata</p>
                  {selectedEntry.metadata ? (
                    <dl className="space-y-2 text-sm">
                      {Object.entries(selectedEntry.metadata).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 rounded-md p-2">
                          <dt className="text-xs text-gray-500 uppercase">{key}</dt>
                          <dd className="text-gray-800">{formatValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-gray-500 text-sm">Nessun metadato registrato.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <DashboardLayout>
      <AuditContent />
    </DashboardLayout>
  );
}
