// UnifiedNotesDisplay.tsx
// Displays all notes from across the busta in one consolidated view

'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { FileText, Loader2, Package, Wrench, Euro, Ship } from 'lucide-react';

interface UnifiedNotesDisplayProps {
  bustaId: string;
}

type NoteItem = {
  source: 'ordini' | 'lavorazioni' | 'pagamenti' | 'spedizione' | 'generali';
  sourceLabel: string;
  note: string;
  metadata?: string; // Extra context like product name, payment type, etc.
  timestamp?: string;
};

export default function UnifiedNotesDisplay({ bustaId }: UnifiedNotesDisplayProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchAllNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const allNotes: NoteItem[] = [];

    try {
      // 1. Fetch busta general notes
      const { data: bustaData, error: bustaError } = await supabase
        .from('buste')
        .select('note_generali, note_spedizione, data_apertura')
        .eq('id', bustaId)
        .single();

      if (bustaError) throw bustaError;

      if (bustaData?.note_generali) {
        allNotes.push({
          source: 'generali',
          sourceLabel: 'Note Generali',
          note: bustaData.note_generali,
          timestamp: bustaData.data_apertura
        });
      }

      if (bustaData?.note_spedizione) {
        allNotes.push({
          source: 'spedizione',
          sourceLabel: 'Spedizione',
          note: bustaData.note_spedizione,
          timestamp: bustaData.data_apertura
        });
      }

      // 2. Fetch ordini_materiali notes
      const { data: ordiniData, error: ordiniError } = await supabase
        .from('ordini_materiali')
        .select('note, descrizione_prodotto, created_at')
        .eq('busta_id', bustaId)
        .not('note', 'is', null);

      if (ordiniError) throw ordiniError;

      ordiniData?.forEach((ordine) => {
        if (ordine.note) {
          allNotes.push({
            source: 'ordini',
            sourceLabel: 'Ordini Materiali',
            note: ordine.note,
            metadata: ordine.descrizione_prodotto,
            timestamp: ordine.created_at || undefined
          });
        }
      });

      // 3. Fetch lavorazioni notes
      const { data: lavorazioniData, error: lavorazioniError } = await supabase
        .from('lavorazioni')
        .select('note, tentativo, created_at')
        .eq('busta_id', bustaId)
        .not('note', 'is', null);

      if (lavorazioniError) throw lavorazioniError;

      lavorazioniData?.forEach((lav) => {
        if (lav.note) {
          allNotes.push({
            source: 'lavorazioni',
            sourceLabel: 'Lavorazioni',
            note: lav.note,
            metadata: `Tentativo #${lav.tentativo}`,
            timestamp: lav.created_at
          });
        }
      });

      // 4. Fetch payment notes (if they exist in your schema)
      // Note: Skipping payment notes for now as the field might not exist in current schema
      // This can be added later if needed

      // Sort by timestamp (newest first)
      allNotes.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotes(allNotes);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      setError(err.message || 'Errore durante il caricamento delle note');
    } finally {
      setIsLoading(false);
    }
  }, [bustaId, supabase]);

  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

  useEffect(() => {
    const handleNotesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ bustaId?: string }>;
      if (!customEvent.detail?.bustaId || customEvent.detail.bustaId === bustaId) {
        fetchAllNotes();
      }
    };

    window.addEventListener('busta:notes:update', handleNotesUpdate);
    return () => window.removeEventListener('busta:notes:update', handleNotesUpdate);
  }, [bustaId, fetchAllNotes]);

  const getSourceIcon = (source: NoteItem['source']) => {
    switch (source) {
      case 'ordini':
        return <Package className="w-4 h-4" />;
      case 'lavorazioni':
        return <Wrench className="w-4 h-4" />;
      case 'pagamenti':
        return <Euro className="w-4 h-4" />;
      case 'spedizione':
        return <Ship className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getSourceColor = (source: NoteItem['source']) => {
    switch (source) {
      case 'ordini':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'lavorazioni':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pagamenti':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'spedizione':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Caricamento note...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-red-600 py-4">
          <p>Errore: {error}</p>
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-gray-500" />
          Note Consolidate
        </h3>
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">Nessuna nota trovata per questa busta</p>
          <p className="text-xs text-gray-400 mt-1">
            Le note vengono raccolte da ordini, lavorazioni, pagamenti e spedizioni
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-gray-500" />
          Note Consolidate
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
            {notes.length}
          </span>
        </h3>
        <button
          onClick={fetchAllNotes}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Aggiorna
        </button>
      </div>

      <div className="space-y-3">
        {notes.map((noteItem, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getSourceColor(noteItem.source)}`}>
                  {getSourceIcon(noteItem.source)}
                  {noteItem.sourceLabel}
                </span>
                {noteItem.metadata && (
                  <span className="text-xs text-gray-500">
                    • {noteItem.metadata}
                  </span>
                )}
              </div>
              {noteItem.timestamp && (
                <span className="text-xs text-gray-400">
                  {new Date(noteItem.timestamp).toLocaleDateString('it-IT')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{noteItem.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          💡 <strong>Tip:</strong> Per cercare note in tutte le buste, usa la{' '}
          <a href="/dashboard/ricerca-avanzata" className="text-blue-600 hover:text-blue-700 underline">
            Ricerca Avanzata
          </a>
        </p>
      </div>
    </div>
  );
}
