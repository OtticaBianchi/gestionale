// ===== FILE: buste/[id]/_components/tabs/LavorazioneTab.tsx =====
// 🔥 VERSIONE FIXED v3 - READ-ONLY COMPLETO CON STORICO VISIBILE

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
import {
  Factory,
  Plus,
  Clock,
  X,
  CheckCircle,
  Calendar,
  Truck,
  Loader2,
  Settings,
  Eye,
  Trash2,
  Package
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

// ===== TYPES LOCALI =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  controllo_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
  payment_plan?: (Database['public']['Tables']['payment_plans']['Row'] & {
    payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
  }) | null;
  info_pagamenti?: Pick<
    Database['public']['Tables']['info_pagamenti']['Row'],
    'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'data_saldo' | 'updated_at'
  > | null;
};

type Lavorazione = {
  id: string;
  busta_id: string;
  tipo_montaggio_id: number;
  stato: string;
  data_inizio: string;
  data_completamento?: string | null;
  data_fallimento?: string | null;
  responsabile_id: string;
  tentativo: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  tipi_montaggio?: { nome: string } | null;
  profiles?: { full_name: string } | null;
};

type TipoMontaggio = Database['public']['Tables']['tipi_montaggio']['Row'];

interface LavorazioneTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean;
  onBustaUpdate?: (updatedBusta: BustaDettagliata) => void;
}

export default function LavorazioneTab({ busta, isReadOnly = false, onBustaUpdate }: LavorazioneTabProps) {
  // ===== STATE =====
  const [lavorazioni, setLavorazioni] = useState<Lavorazione[]>([]);
  const [tipiMontaggio, setTipiMontaggio] = useState<TipoMontaggio[]>([]);
  const [showNuovaLavorazioneForm, setShowNuovaLavorazioneForm] = useState(false);
  const [isLoadingLavorazioni, setIsLoadingLavorazioni] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [controlloCompletato, setControlloCompletato] = useState(false);
  const [isMovingToReady, setIsMovingToReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCheckboxSection, setShowCheckboxSection] = useState(false);

  // User context for role checking
  const { profile } = useUser();

  // ✅ AGGIORNATO: Helper per controlli - solo le azioni di modifica sono limitate
  const canEdit = !isReadOnly && profile?.role !== 'operatore';

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize checkbox state from database
  useEffect(() => {
    if (busta.controllo_completato) {
      setControlloCompletato(true);
    }
  }, [busta.controllo_completato]);

  // Update showCheckboxSection based on busta status and lavorazioni
  useEffect(() => {
    // Show if: in lavorazione OR already moved to pronto_ritiro with completed check
    const shouldShow = isMounted && lavorazioni.length > 0 && (
      (canEdit && busta.stato_attuale === 'in_lavorazione') ||
      (busta.stato_attuale === 'pronto_ritiro' && busta.controllo_completato)
    );

    setShowCheckboxSection(shouldShow);
  }, [busta.stato_attuale, busta.controllo_completato, lavorazioni.length, isMounted, canEdit]);

  // Form per nuova lavorazione
  const [nuovaLavorazioneForm, setNuovaLavorazioneForm] = useState({
    tipo_montaggio_id: '',
    note: '',
    data_inizio: new Date().toISOString().split('T')[0]
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== EFFECTS =====
  useEffect(() => {
    loadLavorazioniData();
  }, [busta.id]);

  // ===== LOAD LAVORAZIONI DATA =====
  const loadLavorazioniData = async () => {
    setIsLoadingLavorazioni(true);
    try {
      console.log('🔍 Loading lavorazioni per busta:', busta.id);
      
      const { data: tipiMontaggioData, error: tipiError } = await supabase
        .from('tipi_montaggio')
        .select('*')
        .order('nome');

      if (tipiError) {
        console.error('❌ Errore caricamento tipi montaggio:', tipiError);
        throw tipiError;
      }

      setTipiMontaggio(tipiMontaggioData || []);

      const { data: lavorazioniData, error: lavorazioniError } = await supabase
        .from('lavorazioni')
        .select(`
          id,
          busta_id,
          tipo_montaggio_id,
          stato,
          data_inizio,
          data_completamento,
          data_fallimento,
          responsabile_id,
          tentativo,
          note,
          created_at,
          updated_at
        `)
        .eq('busta_id', busta.id)
        .order('created_at', { ascending: false });

      if (lavorazioniError) {
        console.error('❌ Errore caricamento lavorazioni:', lavorazioniError);
        throw lavorazioniError;
      }

      // Arricchisci i dati con le informazioni mancanti
      const lavorazioniArricchite = await Promise.all(
        (lavorazioniData || []).map(async (lavorazione) => {
          const tipoMontaggio = tipiMontaggioData?.find(tm => tm.id === lavorazione.tipo_montaggio_id);
          
          let responsabileNome = 'Sconosciuto';
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', lavorazione.responsabile_id)
              .single();
            
            if (profileData?.full_name) {
              responsabileNome = profileData.full_name;
            }
          } catch (error) {
            console.warn('Profilo non trovato per:', lavorazione.responsabile_id);
          }

          return {
            ...lavorazione,
            tipi_montaggio: tipoMontaggio ? { nome: tipoMontaggio.nome } : null,
            profiles: { full_name: responsabileNome }
          } as Lavorazione;
        })
      );

      console.log(`✅ Caricate ${lavorazioniArricchite.length} lavorazioni per busta ${busta.id}`);
      setLavorazioni(lavorazioniArricchite);
      
    } catch (error) {
      console.error('❌ Error loading lavorazioni data:', error);
      setLavorazioni([]);
    } finally {
      setIsLoadingLavorazioni(false);
    }
  };

  // ===== HANDLE SALVA NUOVA LAVORAZIONE =====
  const handleSalvaNuovaLavorazione = async () => {
    if (!nuovaLavorazioneForm.tipo_montaggio_id) {
      alert('Seleziona un tipo di montaggio');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // ✅ NUOVO: Handle "Nessuna Lavorazione" specially
      if (nuovaLavorazioneForm.tipo_montaggio_id === 'nessuna_lavorazione') {
        // Find or create a special "Nessuna Lavorazione" tipo_montaggio
        let nessunaLavorazioneTipoId = tipiMontaggio.find(t => t.nome === 'Nessuna Lavorazione')?.id;

        if (!nessunaLavorazioneTipoId) {
          try {
            const response = await fetch('/api/tipi-montaggio/ensure-nessuna-lavorazione', {
              method: 'POST',
            });

            const payload = await response.json();

            if (!response.ok || !payload?.tipo?.id) {
              throw new Error(payload?.error || 'Errore creazione tipo montaggio');
            }

            const tipoCreato = payload.tipo as TipoMontaggio;

            nessunaLavorazioneTipoId = tipoCreato.id;

            setTipiMontaggio((prev) => {
              const alreadyPresent = prev.some((tipo) => tipo.id === tipoCreato.id || tipo.nome === 'Nessuna Lavorazione');
              if (alreadyPresent) return prev;
              return [...prev, tipoCreato];
            });
          } catch (error) {
            console.error('Error ensuring Nessuna Lavorazione tipo:', error);
            alert(
              'Non è stato possibile creare il tipo "Nessuna Lavorazione". Controlla le migrazioni o contatta un amministratore.'
            );
            setIsSaving(false);
            return;
          }
        }

        // Create a special entry automatically completed
        const { data: lavorazioneCreata, error } = await supabase
          .from('lavorazioni')
          .insert({
            busta_id: busta.id,
            tipo_montaggio_id: nessunaLavorazioneTipoId,
            stato: 'completato',
            data_inizio: new Date().toISOString().split('T')[0],
            data_completamento: new Date().toISOString().split('T')[0],
            responsabile_id: user.id,
            tentativo: 1,
            note: '❌ Nessuna Lavorazione richiesta'
          })
          .select(`
            id,
            busta_id,
            tipo_montaggio_id,
            stato,
            data_inizio,
            data_completamento,
            data_fallimento,
            responsabile_id,
            tentativo,
            note,
            created_at,
            updated_at
          `)
          .single();

        if (error) throw error;

        let responsabileNome = 'Tu';
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (profileData?.full_name) {
            responsabileNome = profileData.full_name;
          }
        } catch (error) {
          console.warn('Profilo non trovato per utente corrente');
        }

        const lavorazioneArricchita: Lavorazione = {
          ...lavorazioneCreata,
          tipi_montaggio: { nome: 'Nessuna Lavorazione' },
          profiles: { full_name: responsabileNome }
        };

        setLavorazioni(prev => [lavorazioneArricchita, ...prev]);

        setNuovaLavorazioneForm({
          tipo_montaggio_id: '',
          note: '',
          data_inizio: new Date().toISOString().split('T')[0]
        });

        setShowNuovaLavorazioneForm(false);
        alert('✅ "Nessuna Lavorazione" registrata. Ora completa il controllo per procedere.');
        return;
      }

      const tentativiEsistenti = lavorazioni.filter(l =>
        l.tipo_montaggio_id?.toString() === nuovaLavorazioneForm.tipo_montaggio_id
      ).length;

      const { data: lavorazioneCreata, error } = await supabase
        .from('lavorazioni')
        .insert({
          busta_id: busta.id,
          tipo_montaggio_id: Number.parseInt(nuovaLavorazioneForm.tipo_montaggio_id),
          stato: 'in_corso',
          data_inizio: nuovaLavorazioneForm.data_inizio,
          responsabile_id: user.id,
          tentativo: tentativiEsistenti + 1,
          note: nuovaLavorazioneForm.note.trim() || null
        })
        .select(`
          id,
          busta_id,
          tipo_montaggio_id,
          stato,
          data_inizio,
          data_completamento,
          data_fallimento,
          responsabile_id,
          tentativo,
          note,
          created_at,
          updated_at
        `)
        .single();

      if (error) throw error;

      const tipoMontaggioNome = tipiMontaggio.find(tm => tm.id === Number.parseInt(nuovaLavorazioneForm.tipo_montaggio_id))?.nome || 'Sconosciuto';
      
      let responsabileNome = 'Tu';
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (profileData?.full_name) {
          responsabileNome = profileData.full_name;
        }
      } catch (error) {
        console.warn('Profilo non trovato per utente corrente');
      }

      const lavorazioneArricchita: Lavorazione = {
        ...lavorazioneCreata,
        tipi_montaggio: { nome: tipoMontaggioNome },
        profiles: { full_name: responsabileNome }
      };

      setLavorazioni(prev => [lavorazioneArricchita, ...prev]);

      setNuovaLavorazioneForm({
        tipo_montaggio_id: '',
        note: '',
        data_inizio: new Date().toISOString().split('T')[0]
      });
      setShowNuovaLavorazioneForm(false);

    } catch (error: any) {
      console.error('❌ Error creating lavorazione:', error);
      alert(`Errore nella creazione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===== HANDLE AGGIORNA STATO LAVORAZIONE =====
  const handleAggiornaStatoLavorazione = async (lavorazioneId: string, nuovoStato: string, noteAggiuntive: string) => {
    try {
      const oggi = new Date().toISOString().split('T')[0];
      const updateData: any = {
        stato: nuovoStato,
        note: noteAggiuntive.trim() || null
      };

      if (nuovoStato === 'completato') {
        updateData.data_completamento = oggi;
        updateData.data_fallimento = null;
      } else if (nuovoStato === 'fallito') {
        updateData.data_fallimento = oggi;
        updateData.data_completamento = null;
      }

      const { error } = await supabase
        .from('lavorazioni')
        .update(updateData)
        .eq('id', lavorazioneId);

      if (error) throw error;

      setLavorazioni(prev => prev.map(lav => 
        lav.id === lavorazioneId 
          ? { 
              ...lav, 
              stato: nuovoStato,
              data_completamento: updateData.data_completamento,
              data_fallimento: updateData.data_fallimento,
              note: noteAggiuntive.trim() || lav.note,
              updated_at: new Date().toISOString()
            }
          : lav
      ));

    } catch (error: any) {
      console.error('❌ Error updating lavorazione:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  // ===== HANDLE DELETE LAVORAZIONE =====
  const handleDeleteLavorazione = async (lavorazioneId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa lavorazione?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lavorazioni')
        .delete()
        .eq('id', lavorazioneId);

      if (error) throw error;

      setLavorazioni(prev => prev.filter(lav => lav.id !== lavorazioneId));

    } catch (error: any) {
      console.error('❌ Error deleting lavorazione:', error);
      alert(`Errore eliminazione: ${error.message}`);
    }
  };

  // ===== HANDLE CONTROLLO COMPLETATO =====
  const handleControlloCompletato = async (checked: boolean) => {
    // Can't uncheck if already completed
    if (!checked && busta.controllo_completato) {
      return;
    }

    if (!checked) {
      setControlloCompletato(false);
      return;
    }

    // Double check con l'utente
    if (!confirm('Hai controllato attentamente che tutto sia a posto? La busta verrà spostata in "Pronto Ritiro".')) {
      setControlloCompletato(false);
      return;
    }

    setControlloCompletato(true);
    setIsMovingToReady(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const now = new Date().toISOString();

      // First, update the quality control fields
      const { error: controlloError } = await supabase
        .from('buste')
        .update({
          controllo_completato: true,
          controllo_completato_da: user.id,
          controllo_completato_at: now
        })
        .eq('id', busta.id);

      if (controlloError) throw controlloError;

      // Then update busta status via API
      const response = await fetch('/api/buste/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bustaId: busta.id,
          oldStatus: busta.stato_attuale,
          newStatus: 'pronto_ritiro',
          tipoLavorazione: busta.tipo_lavorazione
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'aggiornamento dello stato');
      }

      const data = await response.json();
      console.log('✅ Busta moved to pronto_ritiro successfully');

      // Update the busta state locally with ALL new fields
      const updatedBusta = {
        ...busta,
        stato_attuale: 'pronto_ritiro' as const,
        updated_at: data.busta.updated_at,
        controllo_completato: true,
        controllo_completato_da: user.id,
        controllo_completato_at: now
      };

      // Call the parent callback to update the busta
      if (onBustaUpdate) {
        onBustaUpdate(updatedBusta);
      }

      // Invalidate SWR cache to refresh Kanban board
      await mutate('/api/buste');

      console.log('✅ Quality control completed and logged');

    } catch (error: any) {
      console.error('❌ Error completing quality control:', error);
      alert(`Errore: ${error.message}`);
      setControlloCompletato(false);
    } finally {
      setIsMovingToReady(false);
    }
  };

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      
      {/* ✅ READ-ONLY BANNER - Solo se isReadOnly (non per operatori) */}
      {isReadOnly && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Modalità Sola Visualizzazione</h3>
              <p className="text-sm text-orange-700">
                Le lavorazioni possono essere visualizzate ma non modificate.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header Lavorazione */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Factory className="w-6 h-6 mr-3 text-purple-600" />
              Lavorazione & Montaggio
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {isMounted && canEdit
                ? 'Gestione lavorazioni di montaggio con tracking tentativi e stati'
                : 'Visualizza storico lavorazioni di montaggio e relativi stati'
              }
            </p>
          </div>
          
          {/* ✅ MODIFICA: Pulsante solo per chi può editare */}
          {isMounted && canEdit && (
            <button
              onClick={() => setShowNuovaLavorazioneForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nuova Lavorazione</span>
            </button>
          )}
        </div>
      </div>

      {/* ✅ MODIFICA: Form solo per chi può editare */}
      {isMounted && canEdit && showNuovaLavorazioneForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Nuova Lavorazione</h3>
            <button
              onClick={() => setShowNuovaLavorazioneForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tipo-montaggio" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo Montaggio *
              </label>
              <select
                id="tipo-montaggio"
                value={nuovaLavorazioneForm.tipo_montaggio_id}
                onChange={(e) => setNuovaLavorazioneForm(prev => ({ ...prev, tipo_montaggio_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                required
              >
                <option value="">-- Seleziona tipo montaggio --</option>
                {tipiMontaggio.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
                <option value="nessuna_lavorazione" className="font-semibold text-gray-600">
                  ❌ Nessuna Lavorazione
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="data-inizio-lavorazione" className="block text-sm font-medium text-gray-700 mb-1">
                Data Inizio
              </label>
              <input
                id="data-inizio-lavorazione"
                type="date"
                value={nuovaLavorazioneForm.data_inizio}
                onChange={(e) => setNuovaLavorazioneForm(prev => ({ ...prev, data_inizio: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="note-lavorazione" className="block text-sm font-medium text-gray-700 mb-1">
                Note Lavorazione
              </label>
              <textarea
                id="note-lavorazione"
                value={nuovaLavorazioneForm.note}
                onChange={(e) => setNuovaLavorazioneForm(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                placeholder="Dettagli sulla lavorazione, materiali utilizzati, difficoltà riscontrate..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowNuovaLavorazioneForm(false)}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={handleSalvaNuovaLavorazione}
              disabled={!nuovaLavorazioneForm.tipo_montaggio_id || isSaving}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Avvia Lavorazione</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ✅ SEMPRE VISIBILE: Lista Lavorazioni - Storico completo per tutti */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-500" />
            Storico Lavorazioni
            {lavorazioni.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                {lavorazioni.length}
              </span>
            )}
          </h3>
        </div>

        {isLoadingLavorazioni ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Caricamento lavorazioni...</p>
          </div>
        ) : lavorazioni.length === 0 ? (
          <div className="p-8 text-center">
            <Factory className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nessuna lavorazione ancora</h4>
            <p className="text-gray-500 mb-4">
              {isMounted && canEdit
                ? 'Inizia una nuova lavorazione di montaggio per questa busta'
                : 'Non sono ancora state avviate lavorazioni per questa busta'
              }
            </p>

            {isMounted && canEdit && (
              <button
                onClick={() => setShowNuovaLavorazioneForm(true)}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Prima Lavorazione
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {lavorazioni.map((lavorazione) => {
              // ✅ NUOVO: Check if this is "Nessuna Lavorazione"
              const isNessunaLavorazione = lavorazione.tipi_montaggio?.nome === 'Nessuna Lavorazione';

              return (
              <div key={lavorazione.id} className={`p-6 transition-colors ${
                isNessunaLavorazione
                  ? 'bg-gray-100 opacity-70'
                  : 'hover:bg-gray-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className={`text-lg font-medium ${
                        isNessunaLavorazione ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {isNessunaLavorazione
                          ? '❌ Nessuna Lavorazione'
                          : lavorazione.tipi_montaggio?.nome || 'Tipo sconosciuto'
                        }
                      </h4>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        lavorazione.stato === 'completato' ? 'bg-green-100 text-green-800' :
                        lavorazione.stato === 'fallito' ? 'bg-red-100 text-red-800' :
                        lavorazione.stato === 'in_corso' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        TENTATIVO #{lavorazione.tentativo} - {lavorazione.stato.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>
                          <strong>Inizio:</strong> {new Date(lavorazione.data_inizio).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span>
                          <strong>Responsabile:</strong> {lavorazione.profiles?.full_name || 'Sconosciuto'}
                        </span>
                      </div>

                      {(lavorazione.data_completamento || lavorazione.data_fallimento) && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-gray-400" />
                          <span>
                            <strong>Fine:</strong> {
                              lavorazione.data_completamento 
                                ? new Date(lavorazione.data_completamento).toLocaleDateString('it-IT')
                                : lavorazione.data_fallimento 
                                ? new Date(lavorazione.data_fallimento).toLocaleDateString('it-IT')
                                : 'N/A'
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ✅ SEMPRE VISIBILE: Note per tutti gli utenti */}
                    {lavorazione.note && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Note:</strong> {lavorazione.note}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ✅ MODIFICA: Azioni solo per chi può editare */}
                  {isMounted && canEdit && (
                    <div className="flex flex-col space-y-2 ml-4">
                      {lavorazione.stato === 'in_corso' && (
                        <>
                          <button
                            onClick={() => {
                              const note = prompt('Note sulla lavorazione completata:');
                              if (note !== null) {
                                handleAggiornaStatoLavorazione(lavorazione.id, 'completato', note);
                              }
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm"
                          >
                            ✅ Completato
                          </button>
                          <button
                            onClick={() => {
                              const note = prompt('Descrivi il problema/errore:');
                              if (note !== null) {
                                handleAggiornaStatoLavorazione(lavorazione.id, 'fallito', note);
                              }
                            }}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                          >
                            ❌ Fallito
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDeleteLavorazione(lavorazione.id)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors text-sm flex items-center space-x-1"
                        title="Elimina lavorazione"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:block">Elimina</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ SEMPRE VISIBILE: Riepilogo per tutti */}
      {lavorazioni.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {lavorazioni.length}
              </div>
              <div className="text-sm text-gray-500">Totale Lavorazioni</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {lavorazioni.filter(l => l.stato === 'completato').length}
              </div>
              <div className="text-sm text-gray-500">Completate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {lavorazioni.filter(l => l.stato === 'in_corso').length}
              </div>
              <div className="text-sm text-gray-500">In Corso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {lavorazioni.filter(l => l.stato === 'fallito').length}
              </div>
              <div className="text-sm text-gray-500">Fallite</div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ CHECKBOX CONTROLLO COMPLETATO - Always visible when relevant */}
      {showCheckboxSection && (
        <div className={`rounded-lg shadow-sm border-2 p-6 ${
          busta.controllo_completato
            ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
        }`}>
          <div className="flex items-start space-x-4">
            <input
              type="checkbox"
              id="controllo-completato"
              checked={controlloCompletato}
              onChange={(e) => handleControlloCompletato(e.target.checked)}
              disabled={isMovingToReady || busta.controllo_completato}
              className="mt-1 h-6 w-6 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex-1">
              <label
                htmlFor="controllo-completato"
                className={`text-lg font-semibold text-gray-900 select-none ${
                  busta.controllo_completato ? '' : 'cursor-pointer'
                }`}
              >
                Controllo completo ultimato
              </label>

              {!busta.controllo_completato && (
                <p className="text-xs text-gray-600 mt-1">
                  Spunta SOLO dopo aver attentamente controllato che tutto sia a posto
                </p>
              )}

              {busta.controllo_completato && busta.controllo_completato_at && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ Controllo completato da{' '}
                    <span className="font-semibold">{busta.controllo_profile?.full_name || 'Utente'}</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(busta.controllo_completato_at).toLocaleString('it-IT', {
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              )}

              {isMovingToReady && (
                <div className="mt-3 flex items-center space-x-2 text-sm text-green-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Spostamento in Pronto Ritiro...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SHIPPING NOTES (View Only) - Only for Spedizione ===== */}
      {busta.metodo_consegna === 'spedizione' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Note Spedizione
          </h3>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            {busta.note_spedizione ? (
              <div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{busta.note_spedizione}</p>
                {busta.numero_tracking && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs font-medium text-blue-900">Numero Tracking:</p>
                    <p className="text-sm text-blue-800 font-mono">{busta.numero_tracking}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Nessuna nota sulla spedizione</p>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            💡 Le note sulla spedizione possono essere modificate dalla tab <strong>Notifiche & Ritiro</strong>
          </p>
        </div>
      )}
    </div>
  );
}
