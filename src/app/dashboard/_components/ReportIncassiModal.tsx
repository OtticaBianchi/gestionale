'use client';

import { useState } from 'react';
import { X, FileText, Printer, Loader2, Calendar } from 'lucide-react';
import type { IncassoCategoriaResult, IncassoCategoria } from '@/app/api/report/incassi/route';

const LAVORAZIONE_LABELS: Record<string, string> = {
  OCV: 'OCV', OV: 'OV', OS: 'OS', LV: 'LV', LS: 'LS',
  LAC: 'LAC', TALAC: 'TALAC', ACC: 'ACC', RIC: 'RIC', LAB: 'LAB',
  SA: 'SA', SG: 'SG', CT: 'CT', BR: 'BR', SPRT: 'SPRT',
  ES: 'ES', REL: 'REL', FT: 'FT', VFT: 'VFT', VC: 'VC',
};

type CategoriaConChiave = IncassoCategoriaResult & { key: IncassoCategoria };

interface ReportResponse {
  start_date: string;
  end_date: string;
  categorie: CategoriaConChiave[];
  totale_count: number;
  totale_importo: number;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatItalianDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getStartOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = domenica
  const diff = day === 0 ? 6 : day - 1; // lunedì come primo giorno
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

function getStartOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

interface Props {
  onClose: () => void;
}

export default function ReportIncassiModal({ onClose }: Props) {
  const [startDate, setStartDate] = useState<string>(getStartOfWeek());
  const [endDate, setEndDate] = useState<string>(getTodayDate());
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (from: string, to: string) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/api/report/incassi?start_date=${from}&end_date=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore sconosciuto');
      setReport(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => fetchReport(startDate, endDate);

  const handlePresetWeek = () => {
    const from = getStartOfWeek();
    const to = getTodayDate();
    setStartDate(from);
    setEndDate(to);
    fetchReport(from, to);
  };

  const handlePresetMonth = () => {
    const from = getStartOfMonth();
    const to = getTodayDate();
    setStartDate(from);
    setEndDate(to);
    fetchReport(from, to);
  };

  const handlePrint = () => {
    if (!report || report.totale_count === 0) return;

    const rangeLabel = `${formatItalianDate(report.start_date + 'T12:00:00')} – ${formatItalianDate(report.end_date + 'T12:00:00')}`;

    const sections = report.categorie.map(cat => {
      const rows = cat.buste.map(b => `
        <tr>
          <td class="cell-id">${b.readable_id}</td>
          <td class="cell-cliente">${b.cliente_nome}</td>
          <td class="cell-tipo">${LAVORAZIONE_LABELS[b.tipo_lavorazione || ''] || b.tipo_lavorazione || '—'}</td>
          <td class="cell-data">${formatItalianDate(b.data_incasso)}</td>
          <td class="cell-importo">${formatEuro(b.importo)}</td>
        </tr>`).join('');

      return `
        <section>
          <h2>${cat.label} <span class="count">${cat.count} · ${formatEuro(cat.totale)}</span></h2>
          <table>
            <thead><tr><th># Busta</th><th>Cliente</th><th>Tipo</th><th>Data incasso</th><th>Importo</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Report Incassi – ${rangeLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
    header { margin-bottom: 16px; border-bottom: 2px solid #0f6a6e; padding-bottom: 10px; }
    header h1 { font-size: 16px; font-weight: 700; color: #0f6a6e; }
    header p { font-size: 11px; color: #555; margin-top: 3px; }
    section { margin-bottom: 18px; page-break-inside: avoid; }
    section h2 { font-size: 12px; font-weight: 700; color: #0f6a6e; margin-bottom: 6px; }
    section h2 .count { font-weight: 500; color: #555; font-size: 11px; margin-left: 6px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0f6a6e; color: white; }
    thead th { padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; }
    tbody tr { border-bottom: 1px solid #e5e7eb; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    td { padding: 6px 8px; vertical-align: top; }
    .cell-id { white-space: nowrap; font-weight: 600; color: #0f6a6e; width: 90px; }
    .cell-cliente { width: 180px; }
    .cell-tipo { width: 60px; text-align: center; font-weight: 600; }
    .cell-data { width: 90px; white-space: nowrap; }
    .cell-importo { width: 90px; text-align: right; font-weight: 600; }
    footer { margin-top: 16px; font-size: 10px; color: #9ca3af; text-align: right; }
    @media print {
      body { padding: 10px; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Report Incassi – ${rangeLabel}</h1>
    <p>${report.totale_count} bust${report.totale_count !== 1 ? 'e' : 'a'} incassat${report.totale_count !== 1 ? 'e' : 'a'} · Totale ${formatEuro(report.totale_importo)}</p>
  </header>
  ${sections}
  <footer>Generato il ${new Date().toLocaleString('it-IT')} · Kiasma Gestionale</footer>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--ink)]" />
            <h2 className="text-base font-semibold text-slate-900">Report Incassi</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Dal</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:border-[var(--ink)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Al</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={getTodayDate()}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:border-[var(--ink)] focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handlePresetWeek}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Questa settimana
          </button>
          <button
            onClick={handlePresetMonth}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Questo mese
          </button>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !startDate || !endDate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span>Genera</span>
          </button>

          {report && report.totale_count > 0 && (
            <button
              onClick={handlePrint}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Stampa / PDF</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {!isLoading && !error && report && report.totale_count === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              Nessun incasso registrato nell&apos;intervallo selezionato.
            </p>
          )}

          {report && report.totale_count > 0 && (
            <div className="space-y-6">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <strong>{report.totale_count}</strong> buste incassate ·{' '}
                <strong>{formatEuro(report.totale_importo)}</strong> totali
              </div>

              {report.categorie.map(cat => (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">{cat.label}</h3>
                    <span className="text-xs text-slate-500">
                      {cat.count} busta{cat.count !== 1 ? 'e' : ''} · {formatEuro(cat.totale)}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                          <th className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap"># Busta</th>
                          <th className="py-2 px-3 font-semibold text-slate-700">Cliente</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">Tipo</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">Data incasso</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 text-right whitespace-nowrap">Importo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.buste.map((b, i) => (
                          <tr key={b.busta_id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                            <td className="py-2 px-3 font-semibold text-[var(--ink)] whitespace-nowrap">{b.readable_id}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{b.cliente_nome}</td>
                            <td className="py-2 px-3 font-medium text-slate-600 whitespace-nowrap">
                              {LAVORAZIONE_LABELS[b.tipo_lavorazione || ''] || b.tipo_lavorazione || '—'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-600">{formatItalianDate(b.data_incasso)}</td>
                            <td className="py-2 px-3 text-right font-semibold whitespace-nowrap">{formatEuro(b.importo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
