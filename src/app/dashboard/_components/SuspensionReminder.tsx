'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

type SuspendedBustaSummary = {
  id: string;
  readable_id: string | null;
  data_sospensione: string | null;
  data_riesame_sospensione: string | null;
  clienti: { nome: string; cognome: string } | null;
};

const normalizeDateValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.split('T')[0] || '';
};

const parseDateValue = (value: string | null | undefined): Date | null => {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDateDisplay = (value: string | null | undefined): string => {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString('it-IT') : '—';
};

const startOfDay = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveReviewDate = (busta: SuspendedBustaSummary): Date | null => {
  const reviewDate = parseDateValue(busta.data_riesame_sospensione);
  if (reviewDate) return reviewDate;
  const startDate = parseDateValue(busta.data_sospensione);
  return startDate ? addDays(startDate, 3) : null;
};

export default function SuspensionReminder({ buste }: { buste: SuspendedBustaSummary[] }) {
  const dueBuste = useMemo(() => {
    const today = startOfDay(new Date());
    return buste.filter((busta) => {
      const reviewDate = resolveReviewDate(busta);
      if (!reviewDate) return false;
      return startOfDay(reviewDate) <= today;
    });
  }, [buste]);

  const [dismissed, setDismissed] = useState(false);
  const [extendedIds, setExtendedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    if (dueBuste.length > 0) {
      setDismissed(false);
    }
  }, [dueBuste.length]);

  const visibleBuste = useMemo(
    () => dueBuste.filter((busta) => !extendedIds.has(busta.id)),
    [dueBuste, extendedIds]
  );

  const handleExtend = async (busta: SuspendedBustaSummary) => {
    setIsSaving(busta.id);
    try {
      const today = startOfDay(new Date());
      const nextReview = addDays(today, 3);
      const sospensioneDate = normalizeDateValue(busta.data_sospensione) || formatDateInput(today);
      const payload = {
        is_suspended: true,
        data_sospensione: sospensioneDate,
        data_riesame_sospensione: formatDateInput(nextReview)
      };

      const response = await fetch(`/api/buste/${busta.id}/anagrafica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Errore aggiornamento sospensione');
      }

      setExtendedIds((prev) => {
        const next = new Set(prev);
        next.add(busta.id);
        return next;
      });
    } catch (error: any) {
      alert(`Errore nel rinnovo sospensione: ${error.message}`);
    } finally {
      setIsSaving(null);
    }
  };

  if (dismissed || visibleBuste.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border border-yellow-200">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-5 w-5 text-yellow-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Buste sospese da oltre 3 giorni</h3>
            <p className="text-sm text-gray-500">
              Vuoi estendere la sospensione di altri 3 giorni?
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {visibleBuste.map((busta) => {
            const reviewDate = resolveReviewDate(busta);
            const cliente = busta.clienti
              ? `${busta.clienti.cognome} ${busta.clienti.nome}`
              : 'Cliente sconosciuto';

            return (
              <div key={busta.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {busta.readable_id || busta.id}
                  </p>
                  <p className="text-sm text-gray-600">{cliente}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Sospesa dal {formatDateDisplay(busta.data_sospensione)}
                      {reviewDate ? ` · Riesame ${formatDateDisplay(formatDateInput(reviewDate))}` : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleExtend(busta)}
                  disabled={isSaving === busta.id}
                  className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-60"
                >
                  {isSaving === busta.id ? 'Aggiornamento...' : 'Aggiungi 3 giorni'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
