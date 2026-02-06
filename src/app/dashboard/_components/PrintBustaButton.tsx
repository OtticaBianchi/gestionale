'use client';

// ===== FILE: _components/PrintBustaButton.tsx =====

import React, { useCallback, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { formatPhoneDisplay } from '@/utils/formatPhone';

// ===== TYPES =====
interface PrintBustaButtonProps {
  bustaData: {
    id?: string | null;
    readable_id?: string | null;
    cliente_nome: string;
    cliente_cognome: string;
    cliente_telefono?: string | null;
    tipo_lavorazione: string | null;
    data_apertura?: string | null;
  };
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

type NoteSource = 'ordini' | 'lavorazioni' | 'spedizione' | 'generali';

type NoteItem = {
  source: NoteSource;
  sourceLabel: string;
  note: string;
  metadata?: string;
  timestamp?: string;
  orderDate?: string;
  lavorazioneDate?: string;
};

// ===== UTILITY FUNCTION =====
const getTipoLavorazioneFull = (tipo: string | null): string => {
  if (!tipo) return 'DA SPECIFICARE';
  
  const tipiLavorazione: { [key: string]: string } = {
    'OCV': 'OCCHIALI DA VISTA COMPLETI',
    'OV': 'OCCHIALI DA VISTA',
    'OS': 'OCCHIALI DA SOLE',
    'LV': 'LENTI DA VISTA',
    'LS': 'LENTI DA SOLE',
    'LAC': 'LENTI A CONTATTO',
    'TALAC': 'TRAINING APPLICATIVO LAC',
    'ACC': 'ACCESSORI',
    'RIC': 'RICAMBIO',
    'LAB': 'LABORATORIO',
    'SA': 'SAGOMATURA',
    'SG': 'STRINGATURA',
    'CT': 'CONTROLLO VISTA',
    'BR': 'BUONO REGALO',
    'ES': 'ESAME SPECIALISTICO',
    'REL': 'RELAZIONE',
    'FT': 'FATTURA',
    'SPRT': 'SPORT',
    'VFT': 'VERIFICA FATTIBILITA TECNICA'
};
  
  return tipiLavorazione[tipo] || tipo.toUpperCase();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatNoteText = (value: string): string => escapeHtml(value).replace(/\n/g, '<br />');

// ===== MAIN COMPONENT =====
const PrintBustaButton: React.FC<PrintBustaButtonProps> = ({ 
  bustaData, 
  disabled = false, 
  size = 'md',
  className = ''
}) => {

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeProductDescription, setIncludeProductDescription] = useState(true);
  const [includeOrderDate, setIncludeOrderDate] = useState(false);
  const [includeLavorazioneDate, setIncludeLavorazioneDate] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const notesCount = useMemo(() => notes.length, [notes]);

  const fetchNotes = useCallback(async () => {
    if (!bustaData.id) {
      setNotes([]);
      return;
    }

    setIsLoadingNotes(true);
    setNotesError(null);
    const allNotes: NoteItem[] = [];

    try {
      const { data: bustaRow, error: bustaError } = await supabase
        .from('buste')
        .select('note_generali, note_spedizione, data_apertura')
        .eq('id', bustaData.id)
        .single();

      if (bustaError) throw bustaError;

      if (bustaRow?.note_generali) {
        allNotes.push({
          source: 'generali',
          sourceLabel: 'Generali',
          note: bustaRow.note_generali,
          timestamp: bustaRow.data_apertura
        });
      }

      if (bustaRow?.note_spedizione) {
        allNotes.push({
          source: 'spedizione',
          sourceLabel: 'Spedizione',
          note: bustaRow.note_spedizione,
          timestamp: bustaRow.data_apertura
        });
      }

      const { data: ordiniData, error: ordiniError } = await supabase
        .from('ordini_materiali')
        .select('note, descrizione_prodotto, data_ordine, created_at')
        .eq('busta_id', bustaData.id)
        .not('note', 'is', null);

      if (ordiniError) throw ordiniError;

      ordiniData?.forEach((ordine) => {
        if (ordine.note) {
          allNotes.push({
            source: 'ordini',
            sourceLabel: 'Ordini',
            note: ordine.note,
            metadata: ordine.descrizione_prodotto,
            orderDate: ordine.data_ordine || ordine.created_at || undefined,
            timestamp: ordine.created_at || undefined
          });
        }
      });

      const { data: lavorazioniData, error: lavorazioniError } = await supabase
        .from('lavorazioni')
        .select('note, data_inizio, created_at')
        .eq('busta_id', bustaData.id)
        .not('note', 'is', null);

      if (lavorazioniError) throw lavorazioniError;

      lavorazioniData?.forEach((lav) => {
        if (lav.note) {
          allNotes.push({
            source: 'lavorazioni',
            sourceLabel: 'Lavorazioni',
            note: lav.note,
            lavorazioneDate: lav.data_inizio || lav.created_at,
            timestamp: lav.created_at
          });
        }
      });

      allNotes.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotes(allNotes);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      setNotesError(err.message || 'Errore durante il caricamento delle note');
      setNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [bustaData.id, supabase]);

  const buildNotesHtml = useCallback(() => {
    if (!includeNotes) {
      return Array.from({ length: 12 }, () => '<div class="note-line"></div>').join('');
    }

    const noteLines = notes.map((note) => {
      const metaParts: string[] = [];
      if (includeProductDescription && note.source === 'ordini' && note.metadata) {
        metaParts.push(escapeHtml(note.metadata));
      }
      if (includeOrderDate && note.source === 'ordini' && note.orderDate) {
        metaParts.push(new Date(note.orderDate).toLocaleDateString('it-IT'));
      }
      if (includeLavorazioneDate && note.source === 'lavorazioni' && note.lavorazioneDate) {
        metaParts.push(new Date(note.lavorazioneDate).toLocaleDateString('it-IT'));
      }

      const metaSuffix = metaParts.length ? ` (${metaParts.join(' • ')})` : '';
      const noteLabel = `${note.sourceLabel}${metaSuffix}: `;

      return `
        <div class="note-line">
          <span class="note-label">${escapeHtml(noteLabel)}</span>
          <span class="note-text">${formatNoteText(note.note)}</span>
        </div>
      `;
    });

    const blankLines = Array.from({ length: Math.max(12 - noteLines.length, 0) }, () => '<div class="note-line"></div>');

    return [...noteLines, ...blankLines].join('');
  }, [includeLavorazioneDate, includeNotes, includeOrderDate, includeProductDescription, notes]);

  const buildPdfFileName = useCallback(() => {
    const sanitize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    const readableId = bustaData.readable_id ? String(bustaData.readable_id) : 'nuova';
    const cognome = bustaData.cliente_cognome ? sanitize(bustaData.cliente_cognome) : 'cliente';
    const nome = bustaData.cliente_nome ? sanitize(bustaData.cliente_nome) : '';
    const baseName = [readableId, cognome, nome].filter(Boolean).join('-');
    return baseName || 'busta';
  }, [bustaData.cliente_cognome, bustaData.cliente_nome, bustaData.readable_id]);

  // ===== STAMPA DIRETTA SENZA POPUP - MOLTO MEGLIO! =====
  const handlePrint = (notesHtml: string) => {
    // Validazione base
    if (!bustaData.cliente_nome || !bustaData.cliente_cognome) {
      alert('Nome e cognome sono obbligatori per la stampa');
      return;
    }

    try {
      const fileName = buildPdfFileName();

      // ✅ CREA ELEMENTO IFRAME NASCOSTO PER STAMPA DIRETTA
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.left = '-10000px';
      printFrame.style.top = '-10000px';
      printFrame.style.width = '0px';
      printFrame.style.height = '0px';
      printFrame.style.border = 'none';
      
      document.body.appendChild(printFrame);

      const noteSectionHtml = notesHtml || Array.from({ length: 12 }, () => '<div class="note-line"></div>').join('');

      // ✅ CONTENUTO HTML PULITO E SICURO
      const printContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${fileName}</title>
<style>
@page { margin: 10mm; size: A4 landscape; }
* { box-sizing: border-box; }
body { 
font-family: Arial, sans-serif; 
font-size: 12px; 
line-height: 1.3;
margin: 0;
padding: 0;
background: white;
}
.busta-info {
background: #f8f9fa;
padding: 15px;
border: 2px solid #333;
margin-bottom: 20px;
display: grid;
grid-template-columns: 1fr 1fr;
gap: 20px;
}
.busta-numero {
font-size: 48px;
font-weight: bold;
margin: 0 0 8px 0;
}
.cliente-nome {
font-size: 36px;
font-weight: bold;
margin: 0 0 6px 0;
}
.lavorazione {
font-size: 18px;
font-weight: bold;
color: #0066cc;
}
.cliente-telefono {
font-size: 28px;
font-weight: bold;
color: #111;
margin-top: 6px;
letter-spacing: 0.5px;
}
.data-apertura {
font-size: 20px;
color: #666;
margin: 4px 0 0 0;
}
.content-grid {
display: grid;
grid-template-columns: 1.2fr 0.8fr;
gap: 20px;
}
.note-section, .checklist {
padding: 15px;
border: 1px solid #ddd;
}
.note-section h3, .checklist h3 {
font-size: 14px;
font-weight: bold;
margin: 0 0 12px 0;
border-bottom: 1px solid #ddd;
padding-bottom: 4px;
}
.note-line {
border-bottom: 1px solid #ccc;
min-height: 18px;
margin-bottom: 4px;
padding-bottom: 2px;
}
.note-label {
font-weight: bold;
color: #333;
}
.note-text {
white-space: pre-wrap;
}
.checklist-item {
display: flex;
align-items: center;
gap: 8px;
font-size: 11px;
margin-bottom: 8px;
}
.checkbox {
width: 14px;
height: 14px;
border: 2px solid #000;
flex-shrink: 0;
}
.footer {
margin-top: 15px;
padding-top: 10px;
border-top: 1px solid #ccc;
text-align: center;
font-size: 9px;
color: #666;
}
@media print { 
body { print-color-adjust: exact; }
.no-print { display: none; }
}
</style>
</head>
<body>
<div class="busta-info">
<div>
  <div class="busta-numero">#${bustaData.readable_id || 'NUOVA'}</div>
  <div class="data-apertura">Apertura: ${bustaData.data_apertura ? new Date(bustaData.data_apertura).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT')}</div>
</div>
<div style="text-align: right;">
  <div class="cliente-nome">${bustaData.cliente_cognome.toUpperCase()} ${bustaData.cliente_nome.toUpperCase()}</div>
  <div class="lavorazione">${getTipoLavorazioneFull(bustaData.tipo_lavorazione)}</div>
  ${bustaData.cliente_telefono
    ? `<div class="cliente-telefono">${escapeHtml(formatPhoneDisplay(bustaData.cliente_telefono))}</div>`
    : ''}
</div>
</div>
<div class="content-grid">
<div class="note-section">
  <h3>NOTE E APPUNTI</h3>
  ${noteSectionHtml}
</div>
<div class="checklist">
  <h3>CHECKLIST</h3>
  <div class="checklist-item"><div class="checkbox"></div><span>Prescrizione medica</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Montatura scelta</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Lenti ordinate</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Misure prese</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Acconto versato</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Documenti allegati</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Data consegna</span></div>
  <div class="checklist-item"><div class="checkbox"></div><span>Controllo finale</span></div>
</div>
</div>
<div class="footer">
<p>Documento interno - Stampato il ${new Date().toLocaleString('it-IT')}</p>
</div>
</body>
</html>`;

      // ✅ SCRIVE CONTENUTO NELL'IFRAME
      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printContent);
        frameDoc.close();
        if (printFrame.contentWindow) {
          printFrame.contentWindow.document.title = fileName;
        }

        // ✅ STAMPA DIRETTA APPENA IL CONTENUTO È CARICATO
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            
            // ✅ RIMUOVE L'IFRAME DOPO LA STAMPA
            setTimeout(() => {
              if (printFrame.parentNode) {
                document.body.removeChild(printFrame);
              }
            }, 1000);
            
          } catch (printError) {
            console.warn('Errore durante la stampa:', printError);
            // Rimuovi iframe anche in caso di errore
            if (printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          }
        }, 500);
      }

    } catch (error) {
      console.error('❌ Errore stampa:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      alert('Errore durante la stampa: ' + errorMessage);
    }
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    void fetchNotes();
  };

  const handleConfirmPrint = () => {
    const notesHtml = buildNotesHtml();
    setIsDialogOpen(false);
    handlePrint(notesHtml);
  };

  // ===== BUTTON STYLES =====
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
    }
  };

  const canPrint = bustaData.cliente_nome && bustaData.cliente_cognome;
  const isDisabled = disabled || !canPrint;

  return (
    <>
      <button
        onClick={handleOpenDialog}
        disabled={isDisabled}
        className={`
          flex items-center space-x-2 
          ${getSizeClasses()}
          ${isDisabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
          }
          rounded-md transition-colors font-medium
          ${className}
        `}
        title={!canPrint ? 'Inserisci nome e cognome per abilitare la stampa' : 'Stampa template busta'}
      >
        <Printer className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <span>Stampa</span>
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Stampa busta</h3>
                <p className="text-xs text-gray-500">Scegli quali dettagli aggiungere alle note consolidate.</p>
              </div>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3">
              <div className="text-sm text-gray-600">
                Le note consolidate uniscono generali, spedizione, ordini materiali e lavorazioni.
              </div>

              <div className="flex flex-col gap-2 text-sm text-gray-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={includeNotes}
                    onChange={(event) => setIncludeNotes(event.target.checked)}
                  />
                  Includi note consolidate
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={includeProductDescription}
                    onChange={(event) => setIncludeProductDescription(event.target.checked)}
                    disabled={!includeNotes}
                  />
                  Includi descrizione prodotto (ordini)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={includeOrderDate}
                    onChange={(event) => setIncludeOrderDate(event.target.checked)}
                    disabled={!includeNotes}
                  />
                  Includi data ordine (ordini)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={includeLavorazioneDate}
                    onChange={(event) => setIncludeLavorazioneDate(event.target.checked)}
                    disabled={!includeNotes}
                  />
                  Includi data lavorazione (lavorazioni)
                </label>
              </div>

              <div className="text-xs text-gray-500">
                {isLoadingNotes && 'Caricamento note consolidate in corso...'}
                {!isLoadingNotes && notesError && `Errore: ${notesError}`}
                {!isLoadingNotes && !notesError && !includeNotes && 'Stampa senza note consolidate.'}
                {!isLoadingNotes && !notesError && includeNotes && notesCount === 0 && 'Nessuna nota consolidata trovata per questa busta.'}
                {!isLoadingNotes && !notesError && includeNotes && notesCount > 0 && `Note consolidate trovate: ${notesCount}`}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={fetchNotes}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Aggiorna note
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPrint}
                  disabled={isLoadingNotes}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    isLoadingNotes
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Stampa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrintBustaButton;
