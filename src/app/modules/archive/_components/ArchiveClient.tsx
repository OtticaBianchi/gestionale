'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, ChevronDown, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface ArchivedBusta {
  id: string;
  readable_id: string | null;
  stato_attuale: string;
  updated_at: string | null;
  data_apertura: string;
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

  useEffect(() => {
    fetchArchivedBuste();
  }, []);

  const fetchArchivedBuste = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Archived definition: consegnato_pagato with updated_at older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('buste')
        .select(`
          id,
          readable_id,
          stato_attuale,
          updated_at,
          data_apertura,
          clienti:cliente_id (id, nome, cognome, telefono)
        `)
        .eq('stato_attuale', 'consegnato_pagato')
        .lt('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false });

      if (error) {
        setError('Errore nel caricamento dell\'archivio');
        console.error('Archive fetch error:', error);
        return;
      }

      setBuste(data || []);
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
        <h1 className="text-2xl font-bold text-gray-900">Archivio Buste</h1>
        <p className="text-sm text-gray-600">
          Buste consegnate e pagate (archiviate dopo 7 giorni) • {buste.length} buste trovate
        </p>
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
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Aggiornata</th>
                  <th className="text-left px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {buste.map((busta) => (
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
                      <div className="flex items-center gap-2">
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