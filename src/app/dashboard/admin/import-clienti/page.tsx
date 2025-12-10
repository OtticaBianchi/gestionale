'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ListChecks,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/context/UserContext';
import ManualClientForm from './_components/ManualClientForm';

type RawClientRecord = {
  cognome: string;
  nome: string;
  genere: string;
  telefono: string;
  email: string;
};

type ParsedCsvRow = RawClientRecord & {
  rowNumber: number;
};

type ImportRow = ParsedCsvRow & {
  issues: string[];
  status?: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
};

type ImportFailure = {
  rowNumber: number;
  message: string;
  record: RawClientRecord;
};

type ImportSummary = {
  successCount: number;
  failureCount: number;
  skippedCount: number;
  failures: ImportFailure[];
};

type ExistingClient = {
  cognome: string | null;
  nome: string | null;
  telefono: string | null;
  email: string | null;
};

const REQUIRED_HEADERS = ['cognome', 'nome', 'genere'] as const;
const OPTIONAL_HEADERS = ['telefono', 'email'] as const;
const CHUNK_SIZE = 1000;

export default function ImportClientiPage() {
  const router = useRouter();
  const { profile, isLoading } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [existingCheckError, setExistingCheckError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isLoading && profile && !isAdmin) {
      router.replace('/dashboard?error=admin_required');
    }
  }, [isAdmin, isLoading, profile, router]);

  const handleFile = useCallback(
    async (fileList: FileList | null) => {
      if (!isAdmin || !fileList || fileList.length === 0) {
        return;
      }

      const file = fileList[0];
      setFileName(file.name);
      setRows([]);
      setParsingError(null);
      setExistingCheckError(null);
      setImportSummary(null);
      setProgress(0);

      try {
        const text = await file.text();
        const parseResult = parseCsv(text);
        if (parseResult.error) {
          setParsingError(parseResult.error);
          return;
        }

        if (!parseResult.rows.length) {
          setParsingError('Nessun dato trovato nel file CSV selezionato.');
          return;
        }

        setIsCheckingDuplicates(true);

        let validatedRows: ImportRow[] = [];
        try {
          const existingClients = await fetchExistingClients(supabase);
          const existingMap = buildExistingMap(existingClients);
          validatedRows = validateRows(parseResult.rows, existingMap);
        } catch (error: any) {
          console.error('Errore durante la verifica duplicati:', error);
          setExistingCheckError('Impossibile verificare i duplicati nel database. I controlli verranno eseguiti solo sul file.');
          validatedRows = validateRows(parseResult.rows, new Map());
        }

        setRows(validatedRows);
      } catch (error: any) {
        console.error('Errore durante la lettura del CSV:', error);
        setParsingError('Non è stato possibile leggere il file CSV. Verifica il formato e riprova.');
      } finally {
        setIsCheckingDuplicates(false);
      }
    },
    [isAdmin, supabase]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (!isAdmin) return;
      void handleFile(event.dataTransfer?.files ?? null);
    },
    [handleFile, isAdmin]
  );

  const handleImport = useCallback(async () => {
    if (isImporting || !rows.length) return;

    const rowsToImport = rows.filter((row) => row.issues.length === 0);
    if (!rowsToImport.length) {
      setImportSummary({
        successCount: 0,
        failureCount: 0,
        skippedCount: rows.length,
        failures: [],
      });
      return;
    }

    setIsImporting(true);
    setImportSummary(null);
    setProgress(0);

    const failures: ImportFailure[] = [];
    let successCount = 0;
    let processed = 0;

    for (const row of rows) {
      if (row.issues.length > 0) {
        setRows((prev) =>
          prev.map((item) =>
            item.rowNumber === row.rowNumber
              ? { ...item, status: 'skipped', errorMessage: 'Validazione fallita' }
              : item
          )
        );
        continue;
      }

      setRows((prev) =>
        prev.map((item) =>
          item.rowNumber === row.rowNumber ? { ...item, status: 'pending', errorMessage: undefined } : item
        )
      );

      const payload = {
        cognome: row.cognome,
        nome: row.nome,
        genere: row.genere || null,
        telefono: row.telefono || null,
        email: row.email || null,
      };

      const response = await fetch('/api/admin/import-clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({} as { success?: boolean; error?: string }));

      if (!response.ok || !result?.success) {
        failures.push({
          rowNumber: row.rowNumber,
          message: result?.error ?? 'Errore sconosciuto durante l\'inserimento',
          record: {
            cognome: row.cognome,
            nome: row.nome,
            genere: row.genere,
            telefono: row.telefono,
            email: row.email,
          },
        });
        setRows((prev) =>
          prev.map((item) =>
            item.rowNumber === row.rowNumber
              ? { ...item, status: 'error', errorMessage: result?.error ?? 'Errore durante l\'import' }
              : item
          )
        );
      } else {
        successCount += 1;
        setRows((prev) =>
          prev.map((item) =>
            item.rowNumber === row.rowNumber
              ? { ...item, status: 'success', errorMessage: undefined }
              : item
          )
        );
      }

      processed += 1;
      setProgress(Math.round((processed / rowsToImport.length) * 100));
    }

    const skippedCount = rows.length - rowsToImport.length;
    setImportSummary({
      successCount,
      failureCount: failures.length,
      skippedCount,
      failures,
    });
    setIsImporting(false);
  }, [isImporting, rows, supabase]);

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
            <p className="text-sm text-gray-500 mt-1">Accedi nuovamente per procedere con l&apos;import.</p>
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
            <span>Non hai i permessi necessari per importare clienti.</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalRows = rows.length;
  const readyRows = rows.filter((row) => row.issues.length === 0);
  const duplicateRows = rows.filter((row) =>
    row.issues.some((issue) => {
      const normalized = issue.toLowerCase();
      return normalized.includes('duplicato') || normalized.includes('già presente');
    })
  );
  const invalidRows = rows.filter((row) =>
    row.issues.some((issue) => {
      const normalized = issue.toLowerCase();
      return (
        normalized.includes('mancante') ||
        normalized.includes('non valido') ||
        normalized.includes('troppo corto') ||
        normalized.includes('devi fornire')
      );
    })
  );

  const previewRows = rows.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col bg-gray-50">
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 p-3 text-white shadow-lg">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Importa Clienti</h1>
                  <p className="text-sm text-gray-500">
                    Importa clienti tramite file CSV o inserimento manuale
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('csv')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'csv'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Import CSV
              </div>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'manual'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Inserimento Manuale
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {activeTab === 'manual' ? (
              <ManualClientForm />
            ) : (
            <>
            <section>
              <div
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-10 py-16 text-center transition-all ${
                  isDragActive ? 'border-slate-600 bg-slate-50' : 'border-gray-300 bg-white'
                } ${!isAdmin ? 'pointer-events-none opacity-50' : ''}`}
                onDragOver={(event) => {
                  if (!isAdmin) return;
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isAdmin) return;
                  fileInputRef.current?.click();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    if (!isAdmin) return;
                    void handleFile(event.target.files);
                    event.target.value = '';
                  }}
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">Trascina qui il file CSV</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Oppure <span className="font-semibold text-slate-700 underline underline-offset-4">clicca per selezionarlo</span>
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                    cognome,nome,genere,telefono,email
                  </div>
                  {fileName && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                      File selezionato: <span className="font-semibold text-slate-800">{fileName}</span>
                    </div>
                  )}
                </div>
              </div>
              {parsingError && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>{parsingError}</p>
                </div>
              )}
              {existingCheckError && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>{existingCheckError}</p>
                </div>
              )}
            </section>

            {isCheckingDuplicates && (
              <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div>
                    <p className="font-medium text-slate-800">Validazione in corso...</p>
                    <p className="text-sm text-slate-500">
                      Stiamo verificando formati, duplicati interni e corrispondenze già presenti nel database.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {rows.length > 0 && (
              <>
                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Righe totali</span>
                      <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{totalRows}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-600">Pronte per l&apos;import</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-emerald-700">{readyRows.length}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-600">Da rivedere</span>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-amber-700">{rows.length - readyRows.length}</p>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">Duplicati nel CSV</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{duplicateRows.length}</p>
                    {duplicateRows.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Le righe con duplicati nel file saranno ignorate durante l&apos;import.
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">Campi mancanti o invalidi</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{invalidRows.length}</p>
                    {invalidRows.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Verifica cognome, nome, telefono, genere e struttura email.
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">File CSV</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{fileName ?? '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">Prime 5 righe mostrate in anteprima.</p>
                  </div>
                </section>

                {(duplicateRows.length > 0 || invalidRows.length > 0) && (
                  <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {duplicateRows.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-amber-700">Possibili duplicati</h3>
                        <p className="mt-1 text-xs text-amber-600">
                          Verifica i nominativi qui sotto: potrebbero essere già presenti o duplicati nel file.
                        </p>
                        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                          {duplicateRows.map((row) => (
                            <div key={`dup-${row.rowNumber}`} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-amber-900">
                                  #{row.rowNumber} · {row.cognome} {row.nome}
                                </span>
                                <span className="text-[11px] text-amber-600">
                                  {row.telefono || row.email || '—'}
                                </span>
                              </div>
                              <ul className="mt-1 space-y-0.5">
                                {row.issues.map((issue) =>
                                  issue.toLowerCase().includes('duplicato') || issue.toLowerCase().includes('già presente') ? (
                                    <li key={issue}>{issue}</li>
                                  ) : null
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {invalidRows.length > 0 && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-red-700">Campi mancanti o non validi</h3>
                        <p className="mt-1 text-xs text-red-600">
                          Controlla questi record e correggi i campi segnalati prima di rieseguire l&apos;import.
                        </p>
                        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                          {invalidRows.map((row) => (
                            <div key={`inv-${row.rowNumber}`} className="rounded-lg border border-red-200 bg-white/70 px-3 py-2 text-xs text-red-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-red-900">
                                  #{row.rowNumber} · {row.cognome} {row.nome}
                                </span>
                                <span className="text-[11px] text-red-600">
                                  {row.telefono || row.email || '—'}
                                </span>
                              </div>
                              <ul className="mt-1 space-y-0.5">
                                {row.issues.map((issue) => {
                                  const normalized = issue.toLowerCase();
                                  if (
                                    normalized.includes('mancante') ||
                                    normalized.includes('non valido') ||
                                    normalized.includes('troppo corto') ||
                                    normalized.includes('devi fornire')
                                  ) {
                                    return <li key={issue}>{issue}</li>;
                                  }
                                  return null;
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Anteprima (prime 5 righe)</h2>
                      <p className="text-sm text-slate-500">
                        Controlla i dati importati dal CSV prima di procedere con l&apos;import definitivo.
                      </p>
                    </div>
                    <div className="text-sm text-slate-500">
                      Righelli: <span className="font-medium text-slate-700">riga originale · stato validazione</span>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Riga</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Cognome</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Nome</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Genere</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Telefono</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Email</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500">Validazione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {previewRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-xs font-medium text-slate-500">#{row.rowNumber}</td>
                            <td className="px-3 py-2 text-slate-800">{row.cognome}</td>
                            <td className="px-3 py-2 text-slate-800">{row.nome}</td>
                            <td className="px-3 py-2 text-slate-600">{row.genere || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.telefono || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.email || '—'}</td>
                            <td className="px-3 py-2">
                              {row.issues.length === 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Pronto
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {row.issues.map((issue) => (
                                    <span
                                      key={issue}
                                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <p className="mt-3 text-xs text-slate-500">
                      Mostrate solo le prime 5 righe. Tutte le {rows.length} righe saranno considerate durante l&apos;import.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Importazione</h3>
                      <p className="text-sm text-slate-500">
                        I record validi vengono inseriti uno alla volta. Visualizza sotto i risultati e gli eventuali errori.
                      </p>
                    </div>
                    <button
                      onClick={() => void handleImport()}
                      disabled={isImporting || readyRows.length === 0}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                        isImporting || readyRows.length === 0
                          ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                          : 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                      }`}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Import in corso...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Avvia import ({readyRows.length})
                        </>
                      )}
                    </button>
                  </div>

                  {isImporting && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Progressione</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {importSummary && (
                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-medium uppercase text-emerald-600 tracking-wide">Inseriti</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-700">{importSummary.successCount}</p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-medium uppercase text-amber-600 tracking-wide">Saltati</p>
                        <p className="mt-2 text-2xl font-semibold text-amber-700">{importSummary.skippedCount}</p>
                        <p className="mt-1 text-xs text-amber-600">Validazione o duplicati.</p>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-xs font-medium uppercase text-red-600 tracking-wide">Errori</p>
                        <p className="mt-2 text-2xl font-semibold text-red-700">{importSummary.failureCount}</p>
                        <p className="mt-1 text-xs text-red-600">Vedi dettagli sotto.</p>
                      </div>
                    </div>
                  )}

                  {importSummary?.failures.length ? (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-slate-800">Errori riscontrati</h4>
                      <div className="mt-3 space-y-3">
                        {importSummary.failures.map((failure) => (
                          <div
                            key={failure.rowNumber}
                            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  Riga #{failure.rowNumber} - {failure.record.cognome} {failure.record.nome}
                                </p>
                                <p className="text-xs text-red-600 mt-1">{failure.message}</p>
                              </div>
                              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function parseCsv(content: string): { rows: ParsedCsvRow[]; error?: string } {
  if (!content.trim()) {
    return { rows: [], error: 'Il file CSV è vuoto.' };
  }

  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { rows: [], error: 'Il file CSV è vuoto.' };
  }

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = splitCsvLine(headerLine).map((value) => value.trim().toLowerCase());
  const uniqueHeaders = new Set(headers);

  if (headers.length < REQUIRED_HEADERS.length + 1) {
    return {
      rows: [],
      error: 'Il file CSV deve contenere almeno le colonne: cognome,nome,genere e telefono oppure email.',
    };
  }

  for (const required of REQUIRED_HEADERS) {
    if (!uniqueHeaders.has(required)) {
      return {
        rows: [],
        error: `Colonna "${required}" mancante. Assicurati che l'intestazione includa ${REQUIRED_HEADERS.join(', ')}.`,
      };
    }
  }

  const contactHeaders = OPTIONAL_HEADERS.filter((header) => uniqueHeaders.has(header));

  if (contactHeaders.length === 0) {
    return {
      rows: [],
      error: 'Devi includere almeno una colonna tra "telefono" o "email".',
    };
  }

  if (headers.length > REQUIRED_HEADERS.length + OPTIONAL_HEADERS.length) {
    return {
      rows: [],
      error: `Sono state rilevate colonne extra. Usa solo: ${[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].join(', ')}.`,
    };
  }

  for (const header of headers) {
    if (![...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].includes(header as any)) {
      return {
        rows: [],
        error: `Colonna "${header}" non riconosciuta. Usa solo: ${[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].join(', ')}.`,
      };
    }
  }

  const columnIndex = {
    cognome: headers.indexOf('cognome'),
    nome: headers.indexOf('nome'),
    genere: headers.indexOf('genere'),
    telefono: headers.indexOf('telefono'),
    email: headers.indexOf('email'),
  };

  const dataRows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = splitCsvLine(line).map((value) => value.trim());

    if (values.length !== headers.length) {
      return {
        rows: [],
        error: `La riga ${i + 1} non contiene tutte le colonne richieste (${headers.length}).`,
      };
    }

    const cognome = values[columnIndex.cognome] ?? '';
    const nome = values[columnIndex.nome] ?? '';
    const genere = values[columnIndex.genere] ?? '';
    const telefono = columnIndex.telefono >= 0 ? values[columnIndex.telefono] ?? '' : '';
    const email = columnIndex.email >= 0 ? values[columnIndex.email] ?? '' : '';

    dataRows.push({
      rowNumber: i + 1,
      cognome,
      nome,
      genere,
      telefono,
      email,
    });
  }

  return { rows: dataRows };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"' && inQuotes) {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function validateRows(rows: ParsedCsvRow[], existingMap: Map<string, ExistingClient>): ImportRow[] {
  const seenKeys = new Map<string, number>();
  return rows.map((row) => {
    const issues: string[] = [];
    const normalizedCognome = normalizeText(row.cognome);
    const normalizedNome = normalizeText(row.nome);
    const sanitizedPhone = sanitizePhone(row.telefono);
    const normalizedPhoneKey = digitsOnly(sanitizedPhone);
    const normalizedGenere = row.genere ? row.genere.trim().toUpperCase() : '';
    const cleanedEmail = row.email.trim();
    const normalizedEmail = cleanedEmail.toLowerCase();

    if (!normalizedCognome) {
      issues.push('Cognome mancante');
    }

    if (!normalizedNome) {
      issues.push('Nome mancante');
    }

    if (!sanitizedPhone && !normalizedEmail) {
      issues.push('Devi fornire almeno telefono o email');
    } else if (sanitizedPhone && normalizedPhoneKey.length < 6) {
      issues.push('Telefono troppo corto');
    }

    if (normalizedGenere && !['M', 'F', 'X', 'ALTRO'].includes(normalizedGenere)) {
      issues.push('Genere non valido (usa M, F o X)');
    }

    if (cleanedEmail && !isValidEmail(cleanedEmail)) {
      issues.push('Email non valida');
    }

    let duplicateKey: string | null = null;
    if (normalizedCognome && normalizedNome) {
      if (normalizedPhoneKey) {
        duplicateKey = buildKey(normalizedCognome, normalizedNome, `tel:${normalizedPhoneKey}`);
      } else if (normalizedEmail) {
        duplicateKey = buildKey(normalizedCognome, normalizedNome, `email:${normalizedEmail}`);
      }
    }

    if (duplicateKey) {
      if (seenKeys.has(duplicateKey)) {
        issues.push(`Duplicato nel CSV (riga ${seenKeys.get(duplicateKey)})`);
      } else {
        seenKeys.set(duplicateKey, row.rowNumber);
      }

      if (existingMap.has(duplicateKey)) {
        issues.push('Già presente nel database');
      }
    }

    return {
      ...row,
      cognome: capitalizeFirst(normalizedCognome),
      nome: capitalizeFirst(normalizedNome),
      genere: normalizedGenere,
      telefono: sanitizedPhone,
      email: normalizedEmail,
      issues,
    };
  });
}

async function fetchExistingClients(supabase: ReturnType<typeof createClient>): Promise<ExistingClient[]> {
  const collected: ExistingClient[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('clienti')
      .select('cognome, nome, telefono, email')
      .range(from, from + CHUNK_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    collected.push(...data);
    if (data.length < CHUNK_SIZE) {
      break;
    }

    from += CHUNK_SIZE;
  }

  return collected;
}

function buildExistingMap(existingClients: ExistingClient[]): Map<string, ExistingClient> {
  const map = new Map<string, ExistingClient>();
  existingClients.forEach((client) => {
    const normalizedCognome = normalizeText(client.cognome ?? '');
    const normalizedNome = normalizeText(client.nome ?? '');
    if (!normalizedCognome || !normalizedNome) {
      return;
    }

    const phoneDigits = digitsOnly(client.telefono ?? '');
    if (phoneDigits) {
      const phoneKey = buildKey(normalizedCognome, normalizedNome, `tel:${phoneDigits}`);
      if (!map.has(phoneKey)) {
        map.set(phoneKey, client);
      }
    }

    const email = (client.email ?? '').trim().toLowerCase();
    if (email) {
      const emailKey = buildKey(normalizedCognome, normalizedNome, `email:${email}`);
      if (!map.has(emailKey)) {
        map.set(emailKey, client);
      }
    }
  });
  return map;
}

function buildKey(cognome: string, nome: string, contact: string) {
  return `${cognome}::${nome}::${contact}`;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function sanitizePhone(value: string | null | undefined) {
  if (!value) return '';
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  const hasPlus = trimmed.startsWith('+');
  return hasPlus ? `+${digits}` : digits;
}

function digitsOnly(value: string | null | undefined) {
  if (!value) return '';
  return value.replace(/[^\d]/g, '');
}

function capitalizeFirst(value: string) {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
