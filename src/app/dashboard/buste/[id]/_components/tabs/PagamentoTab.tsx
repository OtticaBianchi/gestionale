// ===== FILE: buste/[id]/_components/tabs/PagamentoTab.tsx =====

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
import {
  Bell,
  BellOff, 
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Euro,
  MessageCircle,
  Save,
  X,
  Loader2,
  User,
  Clock,
  Ban,
  Trash2, // ✅ NUOVO: Icona per eliminazione
  RefreshCw // ✅ NUOVO: Icona per rigenera
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

// ===== TYPES LOCALI - GESTISCONO NULL DAL DATABASE =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
};

type InfoPagamento = {
  id?: string;
  busta_id: string;
  ha_acconto: boolean | null;
  importo_acconto: number | null;
  data_acconto: string | null;
  prezzo_finale: number | null;
  modalita_saldo: 'saldo_unico' | 'due_rate' | 'tre_rate' | 'finanziamento';
  is_saldato: boolean | null;
  data_saldo: string | null;
  note_pagamento: string | null;
  created_at?: string;
  updated_at?: string;
};

type RataPagamento = {
  id?: string;
  busta_id: string;
  numero_rata: number;
  importo_rata: number | null;
  data_scadenza: string;
  is_pagata: boolean | null;
  data_pagamento: string | null;
  reminder_attivo: boolean | null;
  ultimo_reminder: string | null;
};

// ✅ Funzioni helper per gestire NULL values
const safeBooleanValue = (value: boolean | null): boolean => {
  return value === true;
};

const safeBooleanForForm = (value: boolean | null): boolean => {
  return value ?? false;
};

// ✅ Funzioni di conversione da database ai tipi locali
const convertDatabaseToLocal = (dbData: any): InfoPagamento => {
  return {
    ...dbData,
    ha_acconto: safeBooleanForForm(dbData.ha_acconto),
    is_saldato: safeBooleanForForm(dbData.is_saldato),
  };
};

const convertRateFromDatabase = (dbRates: any[]): RataPagamento[] => {
  return dbRates.map(rata => ({
    ...rata,
    is_pagata: safeBooleanForForm(rata.is_pagata),
    reminder_attivo: safeBooleanForForm(rata.reminder_attivo),
  }));
};

interface PagamentoTabProps {
  busta: BustaDettagliata;
}

export default function PagamentoTab({ busta }: PagamentoTabProps) {
  // ===== STATE =====
  const [infoPagamento, setInfoPagamento] = useState<InfoPagamento | null>(null);
  
  // User context for role checking
  const { profile } = useUser();
  const [rate, setRate] = useState<RataPagamento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // ✅ NUOVO: Loading per eliminazione
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [isEditingImporti, setIsEditingImporti] = useState(false); // ✅ NUOVO: Modalità editing importi
  const [importiTemp, setImportiTemp] = useState<{ [key: string]: number }>({}); // ✅ NUOVO: Importi temporanei

  // Form state con valori di default sicuri
  const [formData, setFormData] = useState<InfoPagamento>({
    busta_id: busta.id,
    ha_acconto: false,
    importo_acconto: null,
    data_acconto: null,
    prezzo_finale: null,
    modalita_saldo: 'saldo_unico',
    is_saldato: false,
    data_saldo: null,
    note_pagamento: null
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== EFFECTS =====
  useEffect(() => {
    loadPagamentoData();
    getCurrentUser();
  }, [busta.id]);

  // ===== LOAD USER =====
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.full_name) {
          setCurrentUser({ id: user.id, full_name: profile.full_name });
        }
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
    }
  };

  // ===== LOAD PAGAMENTO DATA =====
  const loadPagamentoData = async () => {
    setIsLoading(true);
    try {
      // Carica info pagamento
      const { data: pagamentoData, error: pagamentoError } = await supabase
        .from('info_pagamenti')
        .select('*')
        .eq('busta_id', busta.id)
        .maybeSingle();

      if (pagamentoError && pagamentoError.code !== 'PGRST116') {
        throw pagamentoError;
      }

      if (pagamentoData) {
        const convertedData = convertDatabaseToLocal(pagamentoData);
        setInfoPagamento(convertedData);
        setFormData(convertedData);
      }

      // Carica rate se esistono
      const { data: rateData, error: rateError } = await supabase
        .from('rate_pagamenti')
        .select('*')
        .eq('busta_id', busta.id)
        .order('numero_rata');

      if (rateError) {
        throw rateError;
      }

      if (rateData) {
        const convertedRates = convertRateFromDatabase(rateData);
        setRate(convertedRates);
      }

    } catch (error) {
      console.error('❌ Error loading pagamento data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NUOVA FUNZIONE: Toggle reminder per singola rata
  const toggleReminderRata = async (rataId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('rate_pagamenti')
        .update({ 
          reminder_attivo: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', rataId);

      if (error) throw error;

      // Ricarica i dati per aggiornare l'UI
      await loadPagamentoData();
      
      console.log(`✅ Reminder ${!currentStatus ? 'attivato' : 'disattivato'} per rata`);

    } catch (error: any) {
      console.error('❌ Error toggling reminder:', error);
      alert(`Errore nell'aggiornamento: ${error.message}`);
    }
  };

  // ✅ AGGIORNATA: Attiva/disattiva reminder per tutte le rate SENZA conferma
  const toggleAllReminders = async (activate: boolean) => {
    try {
      const { error } = await supabase
        .from('rate_pagamenti')
        .update({ 
          reminder_attivo: activate,
          updated_at: new Date().toISOString()
        })
        .eq('busta_id', busta.id)
        .eq('is_pagata', false) // Solo rate non pagate
        .gt('numero_rata', 1); // ✅ NUOVO: Escludi prima rata

      if (error) throw error;

      await loadPagamentoData();
      
      // ✅ SEMPLIFICATO: Nessuna conferma, solo feedback discreto
      console.log(`✅ Reminder ${activate ? 'attivati' : 'disattivati'} per tutte le rate`);

    } catch (error: any) {
      console.error('❌ Error toggling all reminders:', error);
      alert(`Errore: ${error.message}`);
    }
  };

  // ✅ CORRETTO: Calcola importi rate automaticamente
  const calcolaImportiRate = (prezzoFinale: number, importoAcconto: number, numeroRate: number) => {
    const restoDaPagare = prezzoFinale - importoAcconto;
    const importoRataBase = Math.floor(restoDaPagare / numeroRate);
    const resto = restoDaPagare % numeroRate;
    
    const importi: number[] = [];
    
    // Le rate sono TUTTE dal resto da pagare, non includono l'acconto
    for (let i = 0; i < numeroRate; i++) {
      if (i === 0 && resto > 0) {
        importi.push(importoRataBase + resto); // Prima rata prende il resto
      } else {
        importi.push(importoRataBase);
      }
    }
    
    return importi;
  };

  // ✅ FIX: GENERA DATE E IMPORTI RATE CORRETTE
  const generaDateRate = (modalita: string, dataInizio: string = new Date().toISOString().split('T')[0]) => {
    const date: string[] = [];
    const start = new Date(dataInizio);
    
    if (modalita === 'due_rate') {
      // ✅ Prima rata: giorno della consegna (dataInizio)
      // ✅ Seconda rata: +30 giorni dalla prima
      date.push(dataInizio); // Prima rata = giorno consegna
      
      const rata2 = new Date(start);
      rata2.setMonth(rata2.getMonth() + 1); // +1 mese
      date.push(rata2.toISOString().split('T')[0]);
      
    } else if (modalita === 'tre_rate') {
      // ✅ Prima rata: giorno della consegna (dataInizio)
      // ✅ Seconda rata: +1 mese dalla prima
      // ✅ Terza rata: +2 mesi dalla prima
      date.push(dataInizio); // Prima rata = giorno consegna
      
      const rata2 = new Date(start);
      rata2.setMonth(rata2.getMonth() + 1); // +1 mese
      date.push(rata2.toISOString().split('T')[0]);
      
      const rata3 = new Date(start);
      rata3.setMonth(rata3.getMonth() + 2); // +2 mesi
      date.push(rata3.toISOString().split('T')[0]);
    }
    
    return date;
  };

  // ✅ NUOVO: ELIMINA RATE ESISTENTI
  const handleEliminaRate = async () => {
    if (!confirm('Sei sicuro di voler eliminare tutte le rate? Questa operazione non può essere annullata.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('rate_pagamenti')
        .delete()
        .eq('busta_id', busta.id);

      if (error) throw error;

      setRate([]);
      alert('✅ Rate eliminate con successo!');
      
    } catch (error: any) {
      console.error('❌ Error deleting rates:', error);
      alert(`Errore nell'eliminazione: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ✅ NUOVO: Gestione modifica importi manuali
  const handleStartEditImporti = () => {
    const temp: { [key: string]: number } = {};
    rate.forEach(rata => {
      if (rata.id && rata.importo_rata) {
        temp[rata.id] = rata.importo_rata;
      }
    });
    setImportiTemp(temp);
    setIsEditingImporti(true);
  };

  const handleSaveImporti = async () => {
    try {
      setIsSaving(true);
      
      // Aggiorna ogni rata con il nuovo importo
      for (const [rataId, importo] of Object.entries(importiTemp)) {
        const { error } = await supabase
          .from('rate_pagamenti')
          .update({ 
            importo_rata: importo,
            updated_at: new Date().toISOString()
          })
          .eq('id', rataId);

        if (error) throw error;
      }

      // Ricarica i dati
      await loadPagamentoData();
      setIsEditingImporti(false);
      setImportiTemp({});
      alert('✅ Importi aggiornati con successo!');
      
    } catch (error: any) {
      console.error('❌ Error updating amounts:', error);
      alert(`Errore nell'aggiornamento: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditImporti = () => {
    setIsEditingImporti(false);
    setImportiTemp({});
  };

  // ===== SAVE PAGAMENTO =====
  const handleSave = async () => {
    if (!currentUser) {
      alert('Utente non autenticato');
      return;
    }

    setIsSaving(true);
    try {
      // Salva/aggiorna info pagamento
      const { data: savedPagamento, error: pagamentoError } = await supabase
        .from('info_pagamenti')
        .upsert({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (pagamentoError) throw pagamentoError;

      // Se modalità con rate e non esistono ancora, crea le rate
      if ((formData.modalita_saldo === 'due_rate' || formData.modalita_saldo === 'tre_rate') && rate.length === 0) {
        const dateRate = generaDateRate(formData.modalita_saldo);
        const numeroRate = formData.modalita_saldo === 'due_rate' ? 2 : 3;
        
        // Calcola importi automaticamente se abbiamo prezzo finale e acconto
        let importiRate: number[] = [];
        if (formData.prezzo_finale && formData.importo_acconto) {
          importiRate = calcolaImportiRate(formData.prezzo_finale, formData.importo_acconto, numeroRate);
        }
        
        const nuoveRate = dateRate.map((data, index) => ({
          busta_id: busta.id,
          numero_rata: index + 1,
          importo_rata: importiRate.length > 0 ? importiRate[index] : null,
          data_scadenza: data,
          is_pagata: index === 0 ? true : false, // ✅ Prima rata già pagata alla consegna
          data_pagamento: index === 0 ? new Date().toISOString().split('T')[0] : null,
          reminder_attivo: false, // ✅ NUOVO: Sempre disattivato di default
          ultimo_reminder: null
        }));

        const { data: rateCreate, error: rateError } = await supabase
          .from('rate_pagamenti')
          .insert(nuoveRate)
          .select();

        if (rateError) throw rateError;
        
        if (rateCreate) {
          const convertedRates = convertRateFromDatabase(rateCreate);
          setRate(convertedRates);
        }
      }

      const convertedSaved = convertDatabaseToLocal(savedPagamento);
      setInfoPagamento(convertedSaved);
      setIsEditing(false);
      
      // ✅ NUOVO: Se modalità è finanziamento, aggiorna stato busta a "consegnato_pagato"
      if (formData.modalita_saldo === 'finanziamento' && busta.stato_attuale !== 'consegnato_pagato') {
        const { error: statoError } = await supabase
          .from('buste')
          .update({
            stato_attuale: 'consegnato_pagato',
            updated_at: new Date().toISOString()
          })
          .eq('id', busta.id);
          
        if (statoError) {
          console.error('❌ Errore aggiornamento stato busta:', statoError);
        } else {
          console.log('✅ Stato busta aggiornato a "consegnato_pagato" per finanziamento');
        }
      }
      
      console.log('✅ Pagamento salvato con successo');

    } catch (error: any) {
      console.error('❌ Error saving pagamento:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===== SEGNA COME SALDATO =====
  const handleSaldato = async () => {
    if (!confirm('Confermi che il cliente ha saldato completamente?')) return;

    setIsSaving(true);
    try {
      const updatedInfo = {
        ...formData,
        is_saldato: true,
        data_saldo: new Date().toISOString().split('T')[0]
      };

      const { error: pagamentoError } = await supabase
        .from('info_pagamenti')
        .upsert(updatedInfo);

      if (pagamentoError) throw pagamentoError;

      // Disabilita tutti i reminder delle rate
      if (rate.length > 0) {
        const { error: rateError } = await supabase
          .from('rate_pagamenti')
          .update({ reminder_attivo: false })
          .eq('busta_id', busta.id);

        if (rateError) throw rateError;
      }

      setFormData(updatedInfo);
      setInfoPagamento(updatedInfo);
      
      await loadPagamentoData();
      alert('✅ Cliente segnato come saldato! Tutti i reminder sono stati disattivati.');

    } catch (error: any) {
      console.error('❌ Error marking as paid:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===== INVIA REMINDER RATA =====
  const handleInviaReminderRata = async (rata: RataPagamento) => {
    if (!currentUser || !busta.clienti) {
      alert('Dati mancanti per inviare il reminder');
      return;
    }

    if (!rata.id) {
      alert('Errore: ID rata mancante');
      return;
    }

    const nomeCliente = busta.clienti.nome;
    const nomeOperatore = currentUser.full_name.split(' ').slice(1).join(' ');
    const dataScadenza = new Date(rata.data_scadenza).toLocaleDateString('it-IT');
    
    const oggi = new Date();
    const scadenza = new Date(rata.data_scadenza);
    const isScaduta = oggi > scadenza;
    
    const testoMessaggio = isScaduta 
      ? `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Ti ricordo gentilmente la rata scaduta il ${dataScadenza}. Quando ti è comodo! Grazie.`
      : `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Ti ricordo che la prossima rata scade il ${dataScadenza}. Grazie!`;

    if (!confirm(`Inviare questo reminder?\n\n"${testoMessaggio}"`)) return;

    try {
      // Salva comunicazione
      const { error: commError } = await supabase
        .from('comunicazioni')
        .insert({
          busta_id: busta.id,
          tipo_messaggio: 'reminder_rata',
          testo_messaggio: testoMessaggio,
          data_invio: new Date().toISOString(),
          destinatario_tipo: 'cliente',
          destinatario_nome: `${busta.clienti.cognome} ${busta.clienti.nome}`,
          destinatario_contatto: busta.clienti.telefono,
          canale_invio: 'whatsapp',
          stato_invio: 'inviato',
          inviato_da: currentUser.id,
          nome_operatore: currentUser.full_name
        });

      if (commError) throw commError;

      // Aggiorna ultimo reminder per la rata
      const { error: rataError } = await supabase
        .from('rate_pagamenti')
        .update({ ultimo_reminder: new Date().toISOString() })
        .eq('id', rata.id);

      if (rataError) throw rataError;

      alert('✅ Reminder inviato e registrato!');
      await loadPagamentoData();

    } catch (error: any) {
      console.error('❌ Error sending reminder:', error);
      alert(`Errore nell'invio: ${error.message}`);
    }
  };

  // ===== SEGNA SINGOLA RATA COME PAGATA =====
  const handlePagaRata = async (rata: RataPagamento) => {
    if (!rata.id) return;
    
    const conferma = confirm(
      `Confermi il pagamento della rata ${rata.numero_rata} del ${new Date(rata.data_scadenza).toLocaleDateString('it-IT')}?`
    );
    
    if (!conferma) return;

    try {
      const oggi = new Date().toISOString().split('T')[0];
      
      // Aggiorna la rata come pagata e disabilita il reminder
      const { error: rataError } = await supabase
        .from('rate_pagamenti')
        .update({
          is_pagata: true,
          data_pagamento: oggi,
          reminder_attivo: false
        })
        .eq('id', rata.id);

      if (rataError) throw rataError;

      // Ricarica le rate aggiornate
      const { data: rateAggiornate, error: fetchError } = await supabase
        .from('rate_pagamenti')
        .select('*')
        .eq('busta_id', busta.id)
        .order('numero_rata');

      if (fetchError) throw fetchError;

      setRate(convertRateFromDatabase(rateAggiornate || []));
      
      // ✅ SWR: Invalida cache dopo pagamento rata
      await mutate('/api/buste');
      
      alert(`Rata ${rata.numero_rata} marcata come pagata!`);
      
    } catch (error: any) {
      console.error('❌ Error marking installment as paid:', error);
      alert(`Errore nel pagamento: ${error.message}`);
    }
  };

  // ===== VERIFICA SE BUSTA È CONSEGNATA =====
  const isBustaConsegnata = busta.stato_attuale === 'consegnato_pagato' || busta.stato_attuale === 'pronto_ritiro';
  
  // ===== VERIFICA SE PAGAMENTO È CONSIDERATO SALDATO =====
  // Finanziamento è equivalente a saldato
  const isEffettivamenteSaldato = safeBooleanValue(formData.is_saldato) || formData.modalita_saldo === 'finanziamento';

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <CreditCard className="w-6 h-6 mr-3 text-green-600" />
              Pagamento & Consegna
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Gestione acconti, rate e promemoria pagamenti
            </p>
          </div>
          
          {/* Status indicator */}
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
            isEffettivamenteSaldato
              ? 'bg-green-100 text-green-800' 
              : isBustaConsegnata
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isEffettivamenteSaldato ? (formData.modalita_saldo === 'finanziamento' ? '🏦 Finanziato' : '✅ Saldato') : 
             isBustaConsegnata ? '⏳ In attesa pagamento' : '📋 Da configurare'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Caricamento dati pagamento...</p>
        </div>
      ) : (
        <>
          {/* Configurazione Pagamento */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Configurazione Pagamento</h3>
              
              {!isEditing && !isEffettivamenteSaldato && profile?.role !== 'operatore' && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Configura</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {/* Prezzo Finale */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">💰 Prezzo Finale</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prezzo_finale || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, prezzo_finale: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Prezzo totale del lavoro (per reportistica)</p>
                </div>

                {/* Acconto */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={safeBooleanValue(formData.ha_acconto)}
                      onChange={(e) => setFormData(prev => ({ ...prev, ha_acconto: e.target.checked, importo_acconto: e.target.checked ? prev.importo_acconto : null }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-700">Ha versato acconto</span>
                  </label>
                </div>

                {safeBooleanValue(formData.ha_acconto) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Importo acconto</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={formData.prezzo_finale || undefined}
                          value={formData.importo_acconto || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, importo_acconto: e.target.value ? parseFloat(e.target.value) : null }))}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data acconto</label>
                      <input
                        type="date"
                        value={formData.data_acconto || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_acconto: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Modalità Saldo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modalità Saldo</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'saldo_unico', label: '💰 Saldo Unico', desc: 'Tutto alla consegna' },
                      { value: 'due_rate', label: '📅 2 Rate', desc: 'Consegna + 1 mese' },
                      { value: 'tre_rate', label: '📅 3 Rate', desc: 'Consegna + 1 mese + 2 mesi' },
                      { value: 'finanziamento', label: '🏦 Finanziamento', desc: '12 rate tramite finanziaria' }
                    ].map(modalita => (
                      <button
                        key={modalita.value}
                        onClick={() => setFormData(prev => ({ ...prev, modalita_saldo: modalita.value as any }))}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          formData.modalita_saldo === modalita.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{modalita.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{modalita.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note Pagamento</label>
                  <textarea
                    value={formData.note_pagamento || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, note_pagamento: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Accordi particolari, note..."
                  />
                </div>

                {/* Pulsanti */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(infoPagamento || {
                        busta_id: busta.id,
                        ha_acconto: false,
                        importo_acconto: null,
                        data_acconto: null,
                        prezzo_finale: null,
                        modalita_saldo: 'saldo_unico',
                        is_saldato: false,
                        data_saldo: null,
                        note_pagamento: null
                      });
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Salva</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {infoPagamento ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Prezzo finale:</span>
                        <p className="font-medium text-lg">
                          {infoPagamento.prezzo_finale ? 
                            `€ ${infoPagamento.prezzo_finale.toFixed(2)}` : 
                            '💰 Non specificato'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Acconto:</span>
                        <p className="font-medium">
                          {safeBooleanValue(infoPagamento.ha_acconto) ? 
                            `✅ €${infoPagamento.importo_acconto?.toFixed(2) || '0.00'} (${infoPagamento.data_acconto ? new Date(infoPagamento.data_acconto).toLocaleDateString('it-IT') : 'data non spec.'})` : 
                            '❌ No'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Modalità:</span>
                        <p className="font-medium">
                          {infoPagamento.modalita_saldo === 'saldo_unico' ? '💰 Saldo Unico' :
                           infoPagamento.modalita_saldo === 'due_rate' ? '📅 2 Rate' :
                           infoPagamento.modalita_saldo === 'tre_rate' ? '📅 3 Rate' :
                           '🏦 Finanziamento'}
                        </p>
                      </div>
                    </div>
                    
                    {infoPagamento.note_pagamento && (
                      <div className="bg-gray-50 rounded-md p-3">
                        <span className="text-sm text-gray-500">Note:</span>
                        <p className="text-sm mt-1">{infoPagamento.note_pagamento}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 italic">Configurazione pagamento non ancora impostata</p>
                )}
              </div>
            )}
          </div>

          {/* ✅ MIGLIORATA: Gestione Rate con controllo reminder granulare */}
          {rate.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Gestione Rate</h3>
                
                <div className="flex items-center space-x-2">
                  {/* ✅ NUOVO: Pulsante modifica importi */}
                  {!isEffettivamenteSaldato && rate.some(r => r.importo_rata) && !isEditingImporti && profile?.role !== 'operatore' && (
                    <button
                      onClick={handleStartEditImporti}
                      className="flex items-center space-x-1 px-3 py-1 bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors text-sm border border-orange-200"
                    >
                      <Euro className="w-4 h-4" />
                      <span>Modifica Importi</span>
                    </button>
                  )}

                  {/* ✅ AGGIORNATO: Pulsanti controllo reminder globale - solo per rate 2+ */}
                  {!isEffettivamenteSaldato && rate.some(r => r.numero_rata > 1 && !safeBooleanValue(r.is_pagata)) && !isEditingImporti && profile?.role !== 'operatore' && (
                    <div className="flex items-center space-x-2 mr-4">
                      <button
                        onClick={() => toggleAllReminders(true)}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors text-sm border border-green-200"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Attiva Tutti</span>
                      </button>
                      <button
                        onClick={() => toggleAllReminders(false)}
                        className="flex items-center space-x-1 px-3 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-sm border border-gray-200"
                      >
                        <BellOff className="w-4 h-4" />
                        <span>Disattiva Tutti</span>
                      </button>
                    </div>
                  )}

                  {/* Pulsanti modifica importi */}
                  {isEditingImporti && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCancelEditImporti}
                        disabled={isSaving}
                        className="flex items-center space-x-1 px-3 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-sm border border-gray-200 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Annulla</span>
                      </button>
                      <button
                        onClick={handleSaveImporti}
                        disabled={isSaving}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Salva Importi</span>
                      </button>
                    </div>
                  )}

                  {/* Pulsante Elimina Rate */}
                  {!isEffettivamenteSaldato && !isEditingImporti && profile?.role !== 'operatore' && (
                    <button
                      onClick={handleEliminaRate}
                      disabled={isDeleting}
                      className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 border border-red-200"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Elimina Rate</span>
                    </button>
                  )}
                  
                  {!isEffettivamenteSaldato && !isEditingImporti && profile?.role !== 'operatore' && (
                    <button
                      onClick={handleSaldato}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Segna come Saldato</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {rate.map((rata) => {
                  const oggi = new Date();
                  const scadenza = new Date(rata.data_scadenza);
                  const isScaduta = oggi > scadenza;
                  const giorniAllaScadenza = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
                  const isInScadenza = giorniAllaScadenza <= 7 && giorniAllaScadenza >= 0;

                  const isRataPagata = safeBooleanValue(rata.is_pagata);
                  const isReminderAttivo = safeBooleanValue(rata.reminder_attivo);
                  
                  // ✅ NUOVO: Prima rata = pagamento alla consegna (sempre pagata)
                  const isPrimaRata = rata.numero_rata === 1;
                  const isRataRitardo = !isPrimaRata && isScaduta; // Solo rate 2+ possono essere in ritardo
                  const isRataInScadenza = !isPrimaRata && isInScadenza; // Solo rate 2+ hanno scadenze

                  return (
                    <div key={rata.id} className={`border rounded-lg p-4 ${
                      isPrimaRata ? 'bg-blue-50 border-blue-200' : // Prima rata = blu (consegna)
                      isRataPagata ? 'bg-green-50 border-green-200' :
                      isRataRitardo ? 'bg-red-50 border-red-200' :
                      isRataInScadenza ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            Rata {rata.numero_rata} - {new Date(rata.data_scadenza).toLocaleDateString('it-IT')}
                            {/* ✅ NUOVO: Importo rata modificabile */}
                            {isEditingImporti && rata.id ? (
                              <div className="inline-block ml-2">
                                <div className="flex items-center space-x-1">
                                  <span className="text-sm text-gray-500">€</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={importiTemp[rata.id] || ''}
                                    onChange={(e) => setImportiTemp(prev => ({
                                      ...prev,
                                      [rata.id!]: e.target.value ? parseFloat(e.target.value) : 0
                                    }))}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            ) : (
                              rata.importo_rata && (
                                <span className="ml-2 text-sm font-semibold text-green-600">
                                  €{rata.importo_rata.toFixed(2)}
                                </span>
                              )
                            )}
                            {/* ✅ MIGLIORATO: Indicatore prima rata più chiaro */}
                            {isPrimaRata && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                💰 Pagamento alla consegna
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>
                              {isPrimaRata ? '💰 Pagamento alla consegna' : // Prima rata = speciale
                               isRataPagata ? '✅ Pagata' :
                               isRataRitardo ? '🔴 Scaduta' :
                               isRataInScadenza ? '🟡 In scadenza' :
                               '⏳ Da pagare'}
                            </span>
                            
                            {/* ✅ NUOVO: Ultimo reminder solo per rate 2+ */}
                            {!isPrimaRata && rata.ultimo_reminder && (
                              <span>
                                Ultimo reminder: {new Date(rata.ultimo_reminder).toLocaleDateString('it-IT')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {/* ✅ NUOVO: Toggle reminder SOLO per rate 2+ */}
                          {!isPrimaRata && !isRataPagata && !isEffettivamenteSaldato && (
                            <button
                              onClick={() => rata.id && toggleReminderRata(rata.id, isReminderAttivo)}
                              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors border ${
                                isReminderAttivo 
                                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                              title={isReminderAttivo ? 'Disattiva reminder per questa rata' : 'Attiva reminder per questa rata'}
                            >
                              {isReminderAttivo ? (
                                <>
                                  <Bell className="w-4 h-4" />
                                  <span>ON</span>
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-4 h-4" />
                                  <span>OFF</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* ✅ NUOVO: Pulsante Invia Reminder SOLO per rate 2+ in scadenza */}
                          {!isPrimaRata && !isRataPagata && !isEffettivamenteSaldato && isReminderAttivo && (isRataInScadenza || isRataRitardo) && (
                            <button
                              onClick={() => handleInviaReminderRata(rata)}
                              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                                isRataRitardo ? 'bg-red-600 text-white hover:bg-red-700' :
                                'bg-yellow-600 text-white hover:bg-yellow-700'
                              }`}
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Invia Reminder</span>
                            </button>
                          )}
                          
                          {/* ✅ NUOVO: Pulsante Paga Rata SOLO per rate 2+ non pagate */}
                          {!isPrimaRata && !isRataPagata && !isEffettivamenteSaldato && (
                            <button
                              onClick={() => handlePagaRata(rata)}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                              title="Segna questa rata come pagata"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Paga Rata</span>
                            </button>
                          )}
                          
                          {/* ✅ NUOVO: Stato reminder disattivato (solo rate 2+) */}
                          {!isPrimaRata && !isRataPagata && !isReminderAttivo && (
                            <span className="text-xs text-gray-500 flex items-center">
                              <BellOff className="w-3 h-3 mr-1" />
                              Reminder OFF
                            </span>
                          )}

                          {/* ✅ NUOVO: Messaggio esplicativo per prima rata */}
                          {isPrimaRata && (
                            <span className="text-xs text-blue-600 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              Nessun reminder necessario
                            </span>
                          )}
                          
                          {/* ✅ NUOVO: Info rata pagata */}
                          {isRataPagata && rata.data_pagamento && (
                            <span className="text-xs text-green-600 flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Pagata il {new Date(rata.data_pagamento).toLocaleDateString('it-IT')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ✅ AGGIORNATA: Spiegazione controllo reminder */}
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">🔔 Controllo Reminder:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>Prima rata:</strong> 💰 Pagamento alla consegna (nessun reminder necessario)</p>
                  <p>• <strong>Rate successive:</strong> Gestione reminder attivabile rata per rata</p>
                  <p>• <strong>Reminder ON:</strong> Il sistema suggerirà l'invio quando la rata è in scadenza</p>
                  <p>• <strong>Reminder OFF:</strong> Nessuna notifica per questa rata (per clienti fidati)</p>
                  <p>• <strong>Controllo granulare:</strong> Puoi decidere rata per rata in base al cliente</p>
                </div>
              </div>
            </div>
          )}

          {/* ✅ NUOVO: Sezione per rigenerare rate se necessario */}
          {infoPagamento && (infoPagamento.modalita_saldo === 'due_rate' || infoPagamento.modalita_saldo === 'tre_rate') && rate.length === 0 && !isEffettivamenteSaldato && profile?.role !== 'operatore' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Rate non ancora generate</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Hai configurato il pagamento a rate ma le scadenze non sono ancora state create.
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Genera Rate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}