'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Clock,
  Filter,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUser } from '@/context/UserContext';

type CestinoItem = {
  table_name: string;
  id: string;
  label: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_name: string | null;
  days_remaining: number;
  is_expiring_soon: boolean;
};

type CestinoStats = {
  total: number;
  expiring_soon: number;
  by_table: Record<string, number>;
};

type RecoveryCheckResult = {
  can_recover: boolean;
  warnings: string[];
  errors: string[];
  details: Record<string, unknown>;
};

const TABLE_LABELS: Record<string, string> = {
  buste: 'Buste',
  clienti: 'Clienti',
  ordini_materiali: 'Ordini',
  info_pagamenti: 'Pagamenti',
  lavorazioni: 'Lavorazioni'
};

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

function CestinoContent() {
  const { profile, isLoading } = useUser();
  const router = useRouter();

  const [isFetching, setIsFetching] = useState(false);
  const [items, setItems] = useState<CestinoItem[]>([]);
  const [stats, setStats] = useState<CestinoStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<string>('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Recovery modal state
  const [selectedItem, setSelectedItem] = useState<CestinoItem | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    success: boolean;
    message: string;
    warnings?: string[];
  } | null>(null);
  const [checkResult, setCheckResult] = useState<RecoveryCheckResult | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const [emptyResult, setEmptyResult] = useState<{
    success: boolean;
    message: string;
    counts?: Record<string, number>;
  } | null>(null);

  const canAccess = profile?.role === 'admin';

  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'admin') {
      router.replace('/dashboard?error=admin_required');
    }
  }, [profile, isLoading, router]);

  const fetchItems = useCallback(async () => {
    if (!canAccess) return;
    setIsFetching(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (tableFilter) params.set('table', tableFilter);
      if (expiringOnly) params.set('expiring', 'true');

      const response = await fetch(`/api/cestino?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Errore nel caricamento');
      }

      const payload = await response.json();
      setItems(payload.data || []);
      setStats(payload.stats || null);
    } catch (error: unknown) {
      console.error('Cestino fetch error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Errore imprevisto');
      setItems([]);
    } finally {
      setIsFetching(false);
    }
  }, [canAccess, tableFilter, expiringOnly]);

  useEffect(() => {
    if (canAccess) {
      void fetchItems();
    }
  }, [canAccess, fetchItems]);

  const handleRecoverClick = (item: CestinoItem) => {
    setSelectedItem(item);
    setRecoveryResult(null);
    setCheckResult(null);
  };

  const handleConfirmRecovery = async () => {
    if (!selectedItem) return;
    setIsRecovering(true);
    setRecoveryResult(null);

    try {
      const response = await fetch('/api/cestino/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: selectedItem.table_name,
          record_id: selectedItem.id
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 409 && payload.check_result) {
          // Conflict - show check results
          setCheckResult(payload.check_result);
          setRecoveryResult({
            success: false,
            message: payload.error || 'Recupero bloccato da conflitti'
          });
        } else {
          setRecoveryResult({
            success: false,
            message: payload.error || 'Errore durante il recupero'
          });
        }
        return;
      }

      setRecoveryResult({
        success: true,
        message: 'Elemento recuperato con successo!',
        warnings: payload.warnings
      });

      // Refresh the list
      setTimeout(() => {
        setSelectedItem(null);
        void fetchItems();
      }, 1500);
    } catch (error) {
      console.error('Recovery error:', error);
      setRecoveryResult({
        success: false,
        message: 'Errore di connessione'
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const closeModal = () => {
    setSelectedItem(null);
    setRecoveryResult(null);
    setCheckResult(null);
  };

  const closeEmptyModal = () => {
    setShowEmptyConfirm(false);
    setEmptyResult(null);
  };

  const handleConfirmEmpty = async () => {
    setIsEmptying(true);
    setEmptyResult(null);

    try {
      const response = await fetch('/api/cestino/empty', { method: 'POST' });
      const payload = await response.json();

      if (!response.ok) {
        setEmptyResult({
          success: false,
          message: payload.error || 'Errore durante lo svuotamento'
        });
        return;
      }

      setEmptyResult({
        success: true,
        message: payload.message || 'Cestino svuotato con successo',
        counts: payload.counts
      });

      setTimeout(() => {
        void fetchItems();
      }, 800);
    } catch (error) {
      console.error('Empty cestino error:', error);
      setEmptyResult({
        success: false,
        message: 'Errore di connessione'
      });
    } finally {
      setIsEmptying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500 text-sm">Caricamento...</p>
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
            Solo gli amministratori possono accedere al Cestino.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">Governance</p>
          <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-gray-400" />
                Cestino
              </h1>
              <p className="text-gray-600 mt-1">
                Elementi eliminati recuperabili. Gli elementi vengono eliminati definitivamente dopo 60 giorni.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEmptyConfirm(true)}
                disabled={isFetching || isEmptying || !stats || stats.total === 0}
                className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Svuota cestino
              </button>
              <button
                onClick={() => void fetchItems()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Aggiorna
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Trash2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Totale nel cestino</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className={`border rounded-lg p-4 ${stats.expiring_soon > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.expiring_soon > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.expiring_soon > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className={`text-sm ${stats.expiring_soon > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    In scadenza (&lt;15 giorni)
                  </p>
                  <p className={`text-2xl font-bold ${stats.expiring_soon > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    {stats.expiring_soon}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ritenzione</p>
                  <p className="text-2xl font-bold text-gray-900">60 giorni</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Filtri</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Tipo</span>
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutti i tipi</option>
                {Object.entries(TABLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={expiringOnly}
                onChange={(e) => setExpiringOnly(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Solo in scadenza</span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Items List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Elemento</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Eliminato da</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Data eliminazione</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Giorni rimasti</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isFetching && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Caricamento...
                    </td>
                  </tr>
                )}

                {!isFetching && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Trash2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      Il cestino è vuoto
                    </td>
                  </tr>
                )}

                {items.map((item) => (
                  <tr
                    key={`${item.table_name}-${item.id}`}
                    className={`hover:bg-gray-50 transition-colors ${item.is_expiring_soon ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {TABLE_LABELS[item.table_name] || item.table_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.label}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.cliente_nome || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.deleted_by_name || 'Sistema'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {dateFormatter.format(new Date(item.deleted_at))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                        item.is_expiring_soon
                          ? 'bg-red-100 text-red-700'
                          : item.days_remaining <= 30
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {item.is_expiring_soon && <AlertTriangle className="h-3 w-3" />}
                        {Math.round(item.days_remaining)} giorni
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRecoverClick(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Recupera
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recovery Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${selectedItem.is_expiring_soon ? 'bg-red-100' : 'bg-blue-100'}`}>
                <RotateCcw className={`h-6 w-6 ${selectedItem.is_expiring_soon ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Recupera elemento</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Stai per recuperare questo elemento dal cestino.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Tipo</span>
                <span className="text-sm font-medium text-gray-900">
                  {TABLE_LABELS[selectedItem.table_name] || selectedItem.table_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Elemento</span>
                <span className="text-sm font-medium text-gray-900">{selectedItem.label}</span>
              </div>
              {selectedItem.cliente_nome && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cliente</span>
                  <span className="text-sm font-medium text-gray-900">{selectedItem.cliente_nome}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Giorni rimasti</span>
                <span className={`text-sm font-medium ${selectedItem.is_expiring_soon ? 'text-red-600' : 'text-gray-900'}`}>
                  {Math.round(selectedItem.days_remaining)} giorni
                </span>
              </div>
            </div>

            {/* Expiring Warning */}
            {selectedItem.is_expiring_soon && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Attenzione: elemento in scadenza
                  </p>
                  <p className="text-sm text-red-600">
                    Questo elemento verrà eliminato definitivamente tra {Math.round(selectedItem.days_remaining)} giorni.
                  </p>
                </div>
              </div>
            )}

            {/* Check Result Errors */}
            {checkResult && checkResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-800">Impossibile recuperare</span>
                </div>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {checkResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Check Result Warnings */}
            {checkResult && checkResult.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-5 w-5 text-amber-500" />
                  <span className="font-medium text-amber-800">Avvisi</span>
                </div>
                <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                  {checkResult.warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recovery Result */}
            {recoveryResult && (
              <div className={`rounded-lg p-3 flex items-start gap-2 ${
                recoveryResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {recoveryResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${recoveryResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {recoveryResult.message}
                  </p>
                  {recoveryResult.warnings && recoveryResult.warnings.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-amber-700 mt-1">
                      {recoveryResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {recoveryResult?.success ? 'Chiudi' : 'Annulla'}
              </button>
              {!recoveryResult?.success && (
                <button
                  onClick={handleConfirmRecovery}
                  disabled={isRecovering || (checkResult?.can_recover === false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isRecovering ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Recupero in corso...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Conferma recupero
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showEmptyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeEmptyModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Svuota cestino</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Questa operazione elimina definitivamente tutti gli elementi nel cestino.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Attenzione: azione irreversibile
                </p>
                <p className="text-sm text-red-600">
                  I dati eliminati non potranno più essere recuperati.
                </p>
              </div>
            </div>

            {emptyResult && (
              <div className={`rounded-lg p-3 flex items-start gap-2 ${
                emptyResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {emptyResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${emptyResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {emptyResult.message}
                  </p>
                  {emptyResult.counts && (
                    <div className="text-xs text-gray-600 space-y-1">
                      {Object.entries(emptyResult.counts).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span>{TABLE_LABELS[key] || key}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeEmptyModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {emptyResult?.success ? 'Chiudi' : 'Annulla'}
              </button>
              {!emptyResult?.success && (
                <button
                  onClick={handleConfirmEmpty}
                  disabled={isEmptying}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isEmptying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Svuotamento in corso...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Conferma svuotamento
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CestinoPage() {
  return (
    <DashboardLayout>
      <CestinoContent />
    </DashboardLayout>
  );
}
