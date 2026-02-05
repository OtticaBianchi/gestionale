'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, ChevronDown, Eye, Search, X, ArrowLeft, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { shouldArchiveBusta } from '@/lib/buste/archiveRules';
import { Database } from '@/types/database.types';
import { useUser } from '@/context/UserContext';

interface ArchivedBusta {
  id: string;
  readable_id: string | null;
  stato_attuale: Database['public']['Enums']['job_status'];
  tipo_lavorazione: Database['public']['Enums']['work_type'] | null;
  updated_at: string | null;
  data_apertura: string;
  archived_mode: string | null;
  ordini_materiali?: { stato: Database['public']['Enums']['ordine_status'] | null }[] | null;
  info_pagamenti?: {
    is_saldato: boolean | null;
    modalita_saldo: string | null;
    note_pagamento: string | null;
    prezzo_finale: number | null;
    importo_acconto: number | null;
    data_saldo: string | null;
    updated_at: string | null;
  } | null;
  payment_plan?: {
    id: string;
    total_amount: number | null;
    acconto: number | null;
    payment_type: string;
    is_completed: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    payment_installments?: {
      id: string;
      paid_amount: number | null;
      is_completed: boolean | null;
      updated_at: string | null;
    }[] | null;
  } | null;
  clienti: {
    id: string;
    nome: string;
    cognome: string;
    telefono: string | null;
  } | null;
}

export default function ArchiveClient() {
  const [buste, setBuste] = useState<ArchivedBusta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateMenu, setShowDuplicateMenu] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBuste, setFilteredBuste] = useState<ArchivedBusta[]>([]);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const { profile } = useUser();
  const canReopen = profile?.role !== 'operatore';

  useEffect(() => {
    fetchArchivedBuste();
  }, []);

  const normalizeRelations = (busta: any): ArchivedBusta => {
    const rawPlan = busta.payment_plan;
    const normalizedPlan = Array.isArray(rawPlan) ? (rawPlan[0] ?? null) : (rawPlan ?? null);
    const rawInfo = busta.info_pagamenti;
    const normalizedInfo = Array.isArray(rawInfo) ? (rawInfo[0] ?? null) : (rawInfo ?? null);

    return {
      ...busta,
      payment_plan: normalizedPlan,
      info_pagamenti: normalizedInfo
    };
  };

  const fetchArchivedBuste = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('buste')
        .select(`
          id,
          readable_id,
          stato_attuale,
          tipo_lavorazione,
          updated_at,
          data_apertura,
          archived_mode,
          ordini_materiali (stato),
          info_pagamenti (
            is_saldato,
            modalita_saldo,
            note_pagamento,
            prezzo_finale,
            importo_acconto,
            data_saldo,
            updated_at
          ),
          payment_plan:payment_plans (
            id,
            total_amount,
            acconto,
            payment_type,
            is_completed,
            created_at,
            updated_at,
            payment_installments (
              id,
              paid_amount,
              is_completed,
              updated_at
            )
          ),
          clienti:cliente_id (id, nome, cognome, telefono)
        `)
        .or('stato_attuale.eq.consegnato_pagato,archived_mode.eq.ANNULLATA')
        .order('updated_at', { ascending: false });

      if (error) {
        setError('Errore nel caricamento dell\'archivio');
        console.error('Archive fetch error:', error);
        return;
      }

      const now = new Date();
      const normalized = (data || []).map(normalizeRelations);
      const filtered = normalized.filter((busta) => {
        if (busta.archived_mode === 'ANNULLATA') return true;
        return shouldArchiveBusta(busta, { now });
      });

      setBuste(filtered);
      setFilteredBuste(filtered);
    } catch (error) {
      console.error('Archive fetch error:', error);
      setError('Errore nel caricamento dell\'archivio');
    } finally {
      setLoading(false);
    }
  };

  const duplicateBusta = async (bustaId: string, includeItems: boolean) => {
    try {
      const response = await fetch('/api/buste/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: bustaId,
          includeItems
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Busta ${data.newReadableId} creata con successo!`);
        // Navigate to new busta
        window.location.href = `/dashboard/buste/${data.newBustaId}`;
      } else {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Impossibile duplicare la busta');
      }
    } catch (error: any) {
      console.error('Error duplicating busta:', error);
      toast.error(error.message || 'Errore nella duplicazione della busta');
    }
    setShowDuplicateMenu(null);
  };

  const reopenBusta = async (busta: ArchivedBusta) => {
    if (!canReopen) return;
    if (busta.archived_mode === 'ANNULLATA') {
      toast.error('Busta annullata: non è possibile riaprirla.');
      return;
    }

    const confirmed = confirm('Riaprire la busta e riportarla in lavorazione?');
    if (!confirmed) return;

    try {
      setReopeningId(busta.id);
      const response = await fetch('/api/buste/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bustaId: busta.id,
          oldStatus: busta.stato_attuale,
          newStatus: 'in_lavorazione',
          tipoLavorazione: busta.tipo_lavorazione
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Impossibile riaprire la busta');
      }

      setBuste(prev => prev.filter(item => item.id !== busta.id));
      setFilteredBuste(prev => prev.filter(item => item.id !== busta.id));
      toast.success('Busta riaperta e riportata in lavorazione.');
    } catch (err: any) {
      console.error('Errore riapertura busta:', err);
      toast.error(err.message || 'Errore nella riapertura della busta');
    } finally {
      setReopeningId(null);
    }
  };

  // Filter buste based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBuste(buste);
    } else {
      const filtered = buste.filter(busta => {
        const searchLower = searchTerm.toLowerCase();
        const bustaId = busta.readable_id?.toLowerCase() || '';
        const clienteNome = busta.clienti?.nome?.toLowerCase() || '';
        const clienteCognome = busta.clienti?.cognome?.toLowerCase() || '';
        const clienteTelefono = busta.clienti?.telefono?.toLowerCase() || '';

        return (
          bustaId.includes(searchLower) ||
          clienteNome.includes(searchLower) ||
          clienteCognome.includes(searchLower) ||
          clienteTelefono.includes(searchLower) ||
          `${clienteCognome} ${clienteNome}`.includes(searchLower)
        );
      });
      setFilteredBuste(filtered);
    }
  }, [searchTerm, buste]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Caricamento archivio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Archivio Buste</h1>
        </div>
        <div className="p-6">
          <div className="text-red-600">{error}</div>
          <button 
            onClick={fetchArchivedBuste}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Back to Dashboard Link */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna alla Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Archivio Buste</h1>
            <p className="text-sm text-gray-600">
              Buste consegnate e pagate (archiviate 24h dopo il pagamento finale) o annullate • {buste.length} buste totali
              {searchTerm && ` • ${filteredBuste.length} risultati`}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cerca per ID busta, nome cliente o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {buste.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Nessuna busta archiviata trovata</div>
            <button
              onClick={fetchArchivedBuste}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Aggiorna
            </button>
          </div>
        ) : filteredBuste.length === 0 && searchTerm ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun risultato trovato</h3>
            <p className="text-gray-500">
              Nessuna busta corrisponde ai criteri di ricerca "{searchTerm}"
            </p>
            <button
              onClick={clearSearch}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Mostra tutte le buste
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Aggiornata</th>
                  <th className="text-left px-4 py-2">Archivio</th>
                  <th className="text-left px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuste.map((busta) => (
                  <tr key={busta.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {busta.readable_id || busta.id}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {busta.updated_at ? new Date(busta.updated_at).toLocaleString('it-IT') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                          busta.archived_mode === 'ANNULLATA'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                        title={
                          busta.archived_mode === 'ANNULLATA'
                            ? 'Busta archiviata perché tutti gli ordini sono stati annullati.'
                            : undefined
                        }
                      >
                        {busta.archived_mode === 'ANNULLATA' ? 'Archiviata — Annullata' : 'Archiviata'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {canReopen && (
                          <button
                            onClick={() => reopenBusta(busta)}
                            disabled={reopeningId === busta.id || busta.archived_mode === 'ANNULLATA'}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={busta.archived_mode === 'ANNULLATA' ? 'Busta annullata: non riapribile' : 'Riapri in lavorazione'}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {reopeningId === busta.id ? 'Riaprendo...' : 'Riapri'}
                          </button>
                        )}
                        <Link 
                          href={`/dashboard/buste/${busta.id}`} 
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Visualizza
                        </Link>
                        
                        <div className="relative">
                          <button
                            onClick={() => setShowDuplicateMenu(showDuplicateMenu === busta.id ? null : busta.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Duplica
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {showDuplicateMenu === busta.id && (
                            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                              <button
                                onClick={() => duplicateBusta(busta.id, false)}
                                className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                Solo Anagrafica
                              </button>
                              <button
                                onClick={() => duplicateBusta(busta.id, true)}
                                className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                Anagrafica + Materiali
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
