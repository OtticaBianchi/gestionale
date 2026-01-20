// ===== FILE: buste/[id]/_components/tabs/NotificheTab.tsx =====
// 🔥 VERSIONE FIXED v2 - READ-ONLY CON STORICO COMPLETO VISIBILE

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import {
  MessageCircle,
  Send,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Phone,
  PhoneCall,
  Trash2,
  Eye,
  Store,
  Home,
  Package,
  Check,
  X,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';

// ===== TYPES =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
  ordini_materiali?: Array<{
    id: string;
    descrizione_prodotto: string;
    stato: string;
  }>;
  payment_plan?: (Database['public']['Tables']['payment_plans']['Row'] & {
    payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
  }) | null;
  info_pagamenti?: Pick<
    Database['public']['Tables']['info_pagamenti']['Row'],
    'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'data_saldo' | 'updated_at'
  > | null;
};

type Comunicazione = Database['public']['Tables']['comunicazioni']['Row'];
type ComunicazioneTipo =
  | 'ordine_pronto'
  | 'sollecito_ritiro'
  | 'nota_comunicazione_cliente';

interface NotificheTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean;
}

type DeliveryMethod = Database['public']['Enums']['metodo_consegna_enum'];
type BustaUpdatePayload = Database['public']['Tables']['buste']['Update'];

const formatDateToInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateInput = () => {
  return formatDateToInputValue(new Date());
};

const extractDateInputFromIso = (iso?: string | null) => {
  if (!iso) return null;
  return iso.split('T')[0] ?? null;
};

const isoFromDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
};

export default function NotificheTab({ busta, isReadOnly = false }: NotificheTabProps) {
  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [isLoadingComunicazioni, setIsLoadingComunicazioni] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  
  // User context for role checking
  const { profile } = useUser();

  // ✅ AGGIORNATO: Helper per controlli - solo le azioni sono limitate
  const canEdit = !isReadOnly && profile?.role !== 'operatore';

  // Stato per editing messaggi
  const [editingMessageType, setEditingMessageType] = useState<'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente' | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [freeNote, setFreeNote] = useState('');
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod | null>(busta.metodo_consegna);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => extractDateInputFromIso(busta.data_selezione_consegna) ?? getTodayDateInput());
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [completionDate, setCompletionDate] = useState<string>(() => {
    const completion = extractDateInputFromIso(busta.data_completamento_consegna);
    return completion ?? getTodayDateInput();
  });
  const [numeroTracking, setNumeroTracking] = useState<string>(busta.numero_tracking || '');
  const [noteSpedizione, setNoteSpedizione] = useState<string>(busta.note_spedizione || '');

  // Phone contact request state
  const [richiedeTelefonata, setRichiedeTelefonata] = useState<boolean>(busta.richiede_telefonata || false);
  const [telefonataAssegnataA, setTelefonataAssegnataA] = useState<string>(busta.telefonata_assegnata_a || '');
  const [telefonataCompletata, setTelefonataCompletata] = useState<boolean>(busta.telefonata_completata || false);
  const [telefonataCompletataData, setTelefonataCompletataData] = useState<string | null>(busta.telefonata_completata_data || null);
  const [isSavingPhoneRequest, setIsSavingPhoneRequest] = useState(false);

  const PHONE_ASSIGNEES = ['Enrico', 'Valentina', 'Marco', 'Roberta', 'Cecilia', 'Anna', 'Monica', 'Noemi'];

  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Carica comunicazioni e utente all'avvio/cambio busta
  useEffect(() => {
    loadComunicazioni();
    getCurrentUser();
  }, [busta.id]);

  useEffect(() => {
    setSelectedDeliveryMethod(busta.metodo_consegna);
    setDeliveryDate(extractDateInputFromIso(busta.data_selezione_consegna) ?? getTodayDateInput());
    setDeliveryError(null);
    setCompletionDate(() => {
      const completion = extractDateInputFromIso(busta.data_completamento_consegna);
      return completion ?? getTodayDateInput();
    });
    setNumeroTracking(busta.numero_tracking || '');
    setNoteSpedizione(busta.note_spedizione || '');
    setRichiedeTelefonata(busta.richiede_telefonata || false);
    setTelefonataAssegnataA(busta.telefonata_assegnata_a || '');
    setTelefonataCompletata(busta.telefonata_completata || false);
    setTelefonataCompletataData(busta.telefonata_completata_data || null);
  }, [busta.metodo_consegna, busta.data_selezione_consegna, busta.numero_tracking, busta.note_spedizione, busta.id, busta.richiede_telefonata, busta.telefonata_assegnata_a, busta.telefonata_completata, busta.telefonata_completata_data]);

  // Carica dati operatore corrente
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
      setCurrentUser(null);
    }
  };

  // Carica le comunicazioni di questa busta
  const loadComunicazioni = async () => {
    setIsLoadingComunicazioni(true);
    try {
      const { data: comunicazioniData, error } = await supabase
        .from('comunicazioni')
        .select('*')
        .eq('busta_id', busta.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComunicazioni(comunicazioniData || []);
    } catch (error) {
      setComunicazioni([]);
    } finally {
      setIsLoadingComunicazioni(false);
    }
  };

  // Genera messaggio predefinito
  const generaMessaggio = (tipo: 'ordine_pronto' | 'sollecito_ritiro') => {
    const nomeCliente = busta.clienti?.nome || 'Cliente';
    const nomeOperatore = currentUser?.full_name?.split(' ').slice(1).join(' ') || 'Operatore';
    if (tipo === 'ordine_pronto') {
      return `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Il tuo acquisto è pronto e puoi passare a ritirarlo quando vuoi. Ti aspettiamo!`;
    } else {
      return `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Ti ricordo che il tuo acquisto è pronto e puoi venire a ritirarlo in negozio. Ti aspettiamo!`;
    }
  };

  // Attiva la modalità editing messaggio/nota
  const avviaEditingMessaggio = (
    tipo: 'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente'
  ) => {
    setEditingMessageType(tipo);
    if (tipo === 'ordine_pronto' || tipo === 'sollecito_ritiro') {
      setCustomMessage(generaMessaggio(tipo));
    } else {
      setCustomMessage('');
    }
  };
  const avviaNotaLibera = () => {
    setEditingMessageType('nota_comunicazione_cliente');
    setFreeNote('');
  };

  // ===== VALIDATION FUNCTIONS =====
  const validateMessageInput = (tipo: 'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente') => {
    if (!currentUser) {
      throw new Error('Dati operatore mancanti.');
    }
    if (tipo !== 'nota_comunicazione_cliente' && !busta.clienti) {
      throw new Error('Dati cliente mancanti.');
    }
  };

  const getMessageText = (tipo: 'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente', testoCustom?: string) => {
    const testoFinale = testoCustom ?? (tipo === 'nota_comunicazione_cliente' ? freeNote : generaMessaggio(tipo));
    if (!testoFinale.trim()) {
      throw new Error('Il testo non può essere vuoto.');
    }
    return testoFinale;
  };

  const savedDeliveryDate = extractDateInputFromIso(busta.data_selezione_consegna);
  const hasPendingDeliveryChanges =
    !!selectedDeliveryMethod &&
    (
      selectedDeliveryMethod !== busta.metodo_consegna ||
      (savedDeliveryDate ?? '') !== deliveryDate
    );
  const deliveryOptions: Array<{ value: DeliveryMethod; label: string; icon: typeof Store }> = [
    { value: 'da_ritirare', label: 'Ritiro in Negozio', icon: Store },
    { value: 'consegna_domicilio', label: 'Consegna a Domicilio', icon: Home },
    { value: 'spedizione', label: 'Spedizione', icon: Package }
  ];

  const deliveryHelperMessage =
    selectedDeliveryMethod === 'da_ritirare'
      ? 'Data disponibile per il ritiro in negozio.'
      : selectedDeliveryMethod === 'consegna_domicilio'
        ? 'Programma la consegna presso il cliente.'
        : selectedDeliveryMethod === 'spedizione'
          ? 'Data in cui avvisiamo il corriere.'
          : '';

  const handleSelectDeliveryMethod = (method: DeliveryMethod) => {
    if (isSavingDelivery) return;
    setSelectedDeliveryMethod(method);
    setDeliveryError(null);
  };

  const handleResetDeliveryChanges = () => {
    setSelectedDeliveryMethod(busta.metodo_consegna);
    setDeliveryDate(savedDeliveryDate ?? getTodayDateInput());
    setDeliveryError(null);
  };

  const ensureCompletionDate = () => {
    if (!completionDate) {
      setDeliveryError('Imposta una data valida per registrare lo stato di consegna.');
      return null;
    }
    setDeliveryError(null);
    return isoFromDateInput(completionDate);
  };

  const handleStatusUpdate = async (updates: Partial<BustaUpdatePayload>) => {
    const completionIso = ensureCompletionDate();
    if (!completionIso) return;
    await updateDeliveryInfo({
      ...updates,
      data_completamento_consegna: completionIso
    });
  };

  const updateDeliveryInfo = async (updates: Partial<BustaUpdatePayload>) => {
    setIsSavingDelivery(true);
    setDeliveryError(null);

    try {
      const { error } = await supabase
        .from('buste')
        .update(updates)
        .eq('id', busta.id);

      if (error) {
        throw error;
      }

      router.refresh();
      return true;
    } catch (error: any) {
      console.error('Errore aggiornamento consegna:', error);
      setDeliveryError(error.message ?? 'Errore durante l\'aggiornamento della consegna.');
      return false;
    } finally {
      setIsSavingDelivery(false);
    }
  };

  const handleSaveDeliverySettings = async () => {
    if (!selectedDeliveryMethod) {
      setDeliveryError('Seleziona una modalità di consegna.');
      return;
    }

    if (!deliveryDate) {
      setDeliveryError('Imposta una data valida.');
      return;
    }

    const updates: Partial<BustaUpdatePayload> = {
      metodo_consegna: selectedDeliveryMethod,
      data_selezione_consegna: isoFromDateInput(deliveryDate)
    };

    if (selectedDeliveryMethod !== busta.metodo_consegna) {
      updates.stato_consegna = 'in_attesa';
      updates.data_completamento_consegna = null;
    }

    await updateDeliveryInfo(updates);
  };

  const handleSaveShippingInfo = async () => {
    setIsSavingDelivery(true);
    setDeliveryError(null);

    try {
      const updates: Partial<BustaUpdatePayload> = {
        numero_tracking: numeroTracking.trim() || null,
        note_spedizione: noteSpedizione.trim() || null
      };

      const { error } = await supabase
        .from('buste')
        .update(updates)
        .eq('id', busta.id);

      if (error) throw error;

      router.refresh();
      alert('Informazioni spedizione salvate con successo');
    } catch (error: any) {
      console.error('Errore salvataggio spedizione:', error);
      setDeliveryError(error.message ?? 'Errore durante il salvataggio.');
    } finally {
      setIsSavingDelivery(false);
    }
  };

  // ===== DATABASE OPERATIONS =====
  const createCommunicationRecord = async (
    tipo: ComunicazioneTipo,
    testoFinale: string,
    overrides?: {
      canaleInvio?: string | null;
      statoInvio?: string | null;
      destinatarioNome?: string | null;
      destinatarioContatto?: string | null;
      destinatarioTipo?: string;
    }
  ) => {
    const response = await fetch('/api/comunicazioni', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bustaId: busta.id,
        tipoMessaggio: tipo,
        testoMessaggio: testoFinale,
        destinatarioTipo: overrides?.destinatarioTipo ?? 'cliente',
        destinatarioNome: overrides?.destinatarioNome ?? (busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : ''),
        destinatarioContatto: overrides?.destinatarioContatto ?? (busta.clienti?.telefono ?? ''),
        canaleInvio: overrides?.canaleInvio ?? 'sms',
        statoInvio: overrides?.statoInvio ?? 'inviato'
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || 'Errore durante la registrazione della comunicazione.');
    }

    return payload?.comunicazione as Comunicazione;
  };

  const updateCommunicationsState = (nuovaComunicazione: any) => {
    setComunicazioni(prev => [...prev, nuovaComunicazione]);
    setEditingMessageType(null);
    setCustomMessage('');
    setFreeNote('');
  };

  const isPhoneCallCommunication = (comunicazione: Comunicazione) =>
    comunicazione.canale_invio?.toLowerCase() === 'telefono' ||
    comunicazione.testo_messaggio?.toLowerCase().startsWith('telefonata al cliente');

  const getLatestPhoneCall = (records: Comunicazione[]) =>
    records
      .filter(isPhoneCallCommunication)
      .sort((a, b) => new Date(b.data_invio).getTime() - new Date(a.data_invio).getTime())[0];

  const deleteCommunicationRecord = async (id: string) => {
    const response = await fetch('/api/comunicazioni', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id,
        bustaId: busta.id
      })
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload?.error || 'Errore durante la rimozione della comunicazione.');
    }
  };

  const handleDeleteCommunication = async (comunicazione: Comunicazione) => {
    if (!canEdit) return;

    const confirmed = window.confirm('Eliminare questa nota interna?');
    if (!confirmed) return;

    try {
      await deleteCommunicationRecord(comunicazione.id);
      setComunicazioni(prev => prev.filter(record => record.id !== comunicazione.id));
    } catch (error: any) {
      console.error('Errore rimozione comunicazione:', error);
      alert(`Errore: ${error.message}`);
    }
  };

  // ===== MAIN MESSAGE FUNCTION =====
  const inviaMessaggio = async (tipo: 'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente', testoCustom?: string) => {
    setIsSendingMessage(true);

    try {
      validateMessageInput(tipo);
      const testoFinale = getMessageText(tipo, testoCustom);
      const nuovaComunicazione = await createCommunicationRecord(tipo, testoFinale);

      updateCommunicationsState(nuovaComunicazione);
      alert('Registrazione effettuata!');

    } catch (error: any) {
      alert(`Errore nell'invio: ${error.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Annulla editing
  const annullaEditing = () => {
    setEditingMessageType(null);
    setCustomMessage('');
    setFreeNote('');
  };

  const isBustaReadyForNotification = busta.stato_attuale === 'pronto_ritiro';

  // Phone contact request handlers
  const handleSavePhoneRequest = async () => {
    if (!telefonataAssegnataA) {
      alert('Seleziona a chi assegnare la telefonata');
      return;
    }

    setIsSavingPhoneRequest(true);
    try {
      const { error } = await supabase
        .from('buste')
        .update({
          richiede_telefonata: true,
          telefonata_assegnata_a: telefonataAssegnataA,
          telefonata_completata: false,
          telefonata_completata_data: null,
          telefonata_completata_da: null
        })
        .eq('id', busta.id);

      if (error) throw error;

      setRichiedeTelefonata(true);
      setTelefonataCompletata(false);
      setTelefonataCompletataData(null);
      router.refresh();
      alert('Richiesta telefonata salvata!');
    } catch (error: any) {
      console.error('Errore salvataggio richiesta telefonata:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
    }
  };

  const handleMarkPhoneCallDone = async () => {
    setIsSavingPhoneRequest(true);
    try {
      const completedAt = new Date().toISOString();
      const { error } = await supabase
        .from('buste')
        .update({
          telefonata_completata: true,
          telefonata_completata_data: completedAt,
          telefonata_completata_da: currentUser?.id || null
        })
        .eq('id', busta.id);

      if (error) throw error;

      setTelefonataCompletata(true);
      setTelefonataCompletataData(completedAt);
      try {
        const assignedTo = telefonataAssegnataA ? `Assegnata a: ${telefonataAssegnataA}.` : 'Assegnazione non indicata.';
        const nuovaComunicazione = await createCommunicationRecord(
          'nota_comunicazione_cliente',
          `Telefonata al cliente completata. ${assignedTo}`
        );
        setComunicazioni(prev => [...prev, nuovaComunicazione]);
      } catch (communicationError) {
        console.error('Errore salvataggio comunicazione telefonata:', communicationError);
      }
      router.refresh();
      alert('Telefonata registrata!');
    } catch (error: any) {
      console.error('Errore registrazione telefonata:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
    }
  };

  const handleCancelPhoneRequest = async () => {
    setIsSavingPhoneRequest(true);
    try {
      const shouldRemoveCommunication = telefonataCompletata;
      const { error } = await supabase
        .from('buste')
        .update({
          richiede_telefonata: false,
          telefonata_assegnata_a: null,
          telefonata_completata: false,
          telefonata_completata_data: null,
          telefonata_completata_da: null
        })
        .eq('id', busta.id);

      if (error) throw error;

      if (shouldRemoveCommunication) {
        const latestPhoneCall = getLatestPhoneCall(comunicazioni);
        if (latestPhoneCall) {
          try {
            await deleteCommunicationRecord(latestPhoneCall.id);
            setComunicazioni(prev => prev.filter(record => record.id !== latestPhoneCall.id));
          } catch (communicationError) {
            console.error('Errore rimozione comunicazione telefonata:', communicationError);
          }
        }
      }

      setRichiedeTelefonata(false);
      setTelefonataAssegnataA('');
      setTelefonataCompletata(false);
      setTelefonataCompletataData(null);
      router.refresh();
      alert('Richiesta telefonata annullata!');
    } catch (error: any) {
      console.error('Errore annullamento richiesta:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
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
                Le comunicazioni possono essere visualizzate ma non è possibile inviare nuovi messaggi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <MessageCircle className="w-6 h-6 mr-3 text-blue-600" />
              Notifiche & Ritiro
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {canEdit 
                ? 'Comunicazioni con il cliente per ritiro prodotti (e note interne)'
                : 'Visualizza storico comunicazioni con il cliente'
              }
            </p>
          </div>
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
            isBustaReadyForNotification
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isBustaReadyForNotification ? '✅ Pronto per Notifica' : '⏳ Non Ancora Pronto'}
          </div>
        </div>
      </div>

      {/* ✅ MODIFICA: Azioni Invio Messaggi - Solo per chi può editare */}
      {canEdit && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Azioni Comunicazione
          </h3>

          {!isBustaReadyForNotification ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <p className="text-yellow-800 font-medium">
                  La busta deve essere nello stato "Pronto Ritiro" per inviare notifiche
                </p>
              </div>
              <p className="text-yellow-700 text-sm mt-2">
                Trascina prima la busta nella colonna "Pronto Ritiro" nel Kanban
              </p>
            </div>
          ) : editingMessageType ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  {editingMessageType === 'ordine_pronto' ? '📝 Modifica Messaggio - Ordine Pronto' :
                    editingMessageType === 'sollecito_ritiro' ? '📝 Modifica Messaggio - Sollecito' :
                      '📝 Aggiungi Nota Interna'}
                </h4>
                <p className="text-sm text-blue-700 mb-4">
                  {editingMessageType === 'nota_comunicazione_cliente'
                    ? 'Aggiungi una nota interna (es: "È passato il marito", "Avvertito via WhatsApp personale")'
                    : 'Modifica il testo del messaggio prima dell\'invio'
                  }
                </p>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {editingMessageType === 'nota_comunicazione_cliente' ? 'Nota:' : 'Testo messaggio:'}
                  </label>
                  <textarea
                    value={editingMessageType === 'nota_comunicazione_cliente' ? freeNote : customMessage}
                    onChange={(e) => {
                      if (editingMessageType === 'nota_comunicazione_cliente') {
                        setFreeNote(e.target.value);
                      } else {
                        setCustomMessage(e.target.value);
                      }
                    }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder={editingMessageType === 'nota_comunicazione_cliente'
                      ? 'Es: È passato il marito, gli abbiamo detto che può venire sua moglie a ritirare...'
                      : 'Modifica il testo del messaggio...'}
                  />

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={annullaEditing}
                      disabled={isSendingMessage}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => {
                        const testo = editingMessageType === 'nota_comunicazione_cliente' ? freeNote : customMessage;
                        inviaMessaggio(editingMessageType, testo);
                      }}
                      disabled={isSendingMessage || (editingMessageType === 'nota_comunicazione_cliente' ? !freeNote.trim() : !customMessage.trim())}
                      className={`px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        editingMessageType === 'ordine_pronto' ? 'bg-green-600 hover:bg-green-700' :
                          editingMessageType === 'sollecito_ritiro' ? 'bg-orange-600 hover:bg-orange-700' :
                            'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isSendingMessage ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                          {editingMessageType === 'nota_comunicazione_cliente' ? 'Salvando...' : 'Inviando...'}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2 inline" />
                          {editingMessageType === 'nota_comunicazione_cliente' ? 'Salva Nota' : 'Invia Messaggio'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Messaggio Ordine Pronto */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <Send className="w-4 h-4 mr-2 text-green-600" />
                  Avvisa Ordine Pronto
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Notifica il cliente che i prodotti sono pronti per il ritiro
                </p>
                <div className="bg-gray-50 rounded-md p-3 mb-3">
                  <p className="text-xs text-gray-700 italic">
                    {generaMessaggio('ordine_pronto')}
                  </p>
                </div>
                <button
                  onClick={() => avviaEditingMessaggio('ordine_pronto')}
                  disabled={isSendingMessage}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Personalizza e Invia
                </button>
              </div>

              {/* Messaggio Sollecito */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-orange-600" />
                  Sollecito Ritiro
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Invia un promemoria per prodotti non ancora ritirati
                </p>
                <div className="bg-gray-50 rounded-md p-3 mb-3">
                  <p className="text-xs text-gray-700 italic">
                    {generaMessaggio('sollecito_ritiro')}
                  </p>
                </div>
                <button
                  onClick={() => avviaEditingMessaggio('sollecito_ritiro')}
                  disabled={isSendingMessage}
                  className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Personalizza e Invia
                </button>
              </div>

              {/* Nota Interna */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2 text-blue-600" />
                  Nota Interna
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Aggiungi una comunicazione interna (nessun invio al cliente)
                </p>
                <div className="bg-gray-50 rounded-md p-3 mb-3">
                  <p className="text-xs text-gray-700 italic">
                    Es: "È passato il marito", "Avvertito via WhatsApp personale"
                  </p>
                </div>
                <button
                  onClick={avviaNotaLibera}
                  disabled={isSendingMessage}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <User className="w-4 h-4 mr-2" />
                  Aggiungi Nota
                </button>
              </div>

              {/* Richiesta Telefonata */}
              <div className={`border rounded-lg p-4 ${
                richiedeTelefonata && !telefonataCompletata
                  ? 'border-red-300 bg-red-50'
                  : telefonataCompletata
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200'
              }`}>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <PhoneCall className={`w-4 h-4 mr-2 ${
                    richiedeTelefonata && !telefonataCompletata
                      ? 'text-red-600'
                      : 'text-purple-600'
                  }`} />
                  Contatto Telefonico
                </h4>

                {telefonataCompletata ? (
                  // Telefonata completata
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Telefonata effettuata</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Assegnata a: <strong>{telefonataAssegnataA || 'Non assegnata'}</strong>
                    </p>
                    {telefonataCompletataData && (
                      <p className="text-xs text-gray-500">
                        Completata il {new Date(telefonataCompletataData).toLocaleDateString('it-IT')}
                      </p>
                    )}
                    <button
                      onClick={handleCancelPhoneRequest}
                      disabled={isSavingPhoneRequest}
                      className="w-full mt-2 flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Resetta
                    </button>
                  </div>
                ) : richiedeTelefonata ? (
                  // Telefonata richiesta ma non completata
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <Phone className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-medium">Da contattare</span>
                    </div>
                    <p className="text-xs text-gray-700">
                      Assegnata a: <strong>{telefonataAssegnataA || 'Non assegnata'}</strong>
                    </p>
                    <button
                      onClick={handleMarkPhoneCallDone}
                      disabled={isSavingPhoneRequest}
                      className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingPhoneRequest ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Telefonato al Cliente
                    </button>
                    <button
                      onClick={handleCancelPhoneRequest}
                      disabled={isSavingPhoneRequest}
                      className="w-full flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Annulla richiesta
                    </button>
                  </div>
                ) : (
                  // Nessuna telefonata richiesta
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Il cliente dev&apos;essere contattato telefonicamente
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Assegna a:
                      </label>
                      <select
                        value={telefonataAssegnataA}
                        onChange={(e) => setTelefonataAssegnataA(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Seleziona...</option>
                        {PHONE_ASSIGNEES.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleSavePhoneRequest}
                      disabled={isSavingPhoneRequest || !telefonataAssegnataA}
                      className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingPhoneRequest ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <PhoneCall className="w-4 h-4 mr-2" />
                      )}
                      Richiedi Telefonata
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DELIVERY MODE MANAGEMENT ===== */}
      {canEdit && isBustaReadyForNotification && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Metodo di Consegna
          </h3>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {deliveryOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedDeliveryMethod === option.value;
                const isSaved = busta.metodo_consegna === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectDeliveryMethod(option.value)}
                    disabled={isSavingDelivery}
                    className={`p-4 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isSaved
                          ? 'border-blue-200 bg-blue-50/70'
                          : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2 text-center">
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{option.label}</span>
                      {isSelected && selectedDeliveryMethod !== busta.metodo_consegna && (
                        <span className="text-xs font-semibold text-blue-600">Nuova selezione</span>
                      )}
                      {!isSelected && isSaved && (
                        <span className="text-xs text-gray-500">Impostazione salvata</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDeliveryMethod ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-blue-900">
                      {selectedDeliveryMethod === 'spedizione' ? 'Data Avviso Corriere' : 'Data impostazione'}
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(event) => {
                        setDeliveryDate(event.target.value);
                        setDeliveryError(null);
                      }}
                      className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    {deliveryHelperMessage && (
                      <p className="mt-2 text-xs text-blue-700">
                        {deliveryHelperMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 md:flex-none">
                    <button
                      type="button"
                      onClick={handleResetDeliveryChanges}
                      disabled={!hasPendingDeliveryChanges || isSavingDelivery}
                      className="px-4 py-2 rounded-md border border-blue-200 bg-white text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDeliverySettings}
                      disabled={!hasPendingDeliveryChanges || isSavingDelivery}
                      className="px-4 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingDelivery ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvataggio...
                        </span>
                      ) : (
                        'Salva impostazioni'
                      )}
                    </button>
                  </div>
                </div>
                {deliveryError && (
                  <p className="mt-3 text-sm text-red-600">{deliveryError}</p>
                )}
                {hasPendingDeliveryChanges && !deliveryError && (
                  <p className="mt-3 text-xs text-blue-700">
                    Salva per confermare la nuova modalità di consegna.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Seleziona una modalità per iniziare a tracciare la consegna.
              </p>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              {busta.metodo_consegna && busta.data_selezione_consegna ? (
                <>
                  <p className="text-sm text-gray-700 mb-3">
                    <strong>
                      {busta.metodo_consegna === 'da_ritirare' && 'Da ritirare in negozio'}
                      {busta.metodo_consegna === 'consegna_domicilio' && 'Da consegnare a domicilio'}
                      {busta.metodo_consegna === 'spedizione' && 'Da spedire'}
                    </strong>{' '}
                    dal {new Date(busta.data_selezione_consegna).toLocaleDateString('it-IT')}
                    {hasPendingDeliveryChanges && (
                      <span className="ml-2 text-xs text-blue-700">(in attesa di salvataggio)</span>
                    )}
                  </p>

                  {hasPendingDeliveryChanges ? (
                    <p className="text-xs text-blue-700">
                      Salva le modifiche per aggiornare le azioni disponibili.
                    </p>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="flex-1 md:max-w-xs">
                          <label className="block text-sm font-medium text-gray-700">
                            {busta.metodo_consegna === 'spedizione' ? 'Data Consegna Corriere' : 'Data da registrare'}
                          </label>
                          <input
                            type="date"
                            value={completionDate}
                            onChange={(event) => {
                              setCompletionDate(event.target.value);
                              setDeliveryError(null);
                            }}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Verrà usata come data per l&apos;azione selezionata (spedito, consegnato, ecc.).
                          </p>
                        </div>
                        {busta.data_completamento_consegna && (
                          <div className="rounded-md bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                            Ultimo aggiornamento registrato:{' '}
                            <strong>{new Date(busta.data_completamento_consegna).toLocaleDateString('it-IT')}</strong>
                          </div>
                        )}
                      </div>

                      {busta.stato_consegna === 'in_attesa' && (
                        <div className="flex flex-wrap gap-2">
                          {busta.metodo_consegna === 'da_ritirare' && (
                            <button
                              onClick={async () => {
                                await handleStatusUpdate({
                                  stato_consegna: 'ritirato',
                                  stato_attuale: 'consegnato_pagato'
                                });
                              }}
                              disabled={isSavingDelivery}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              ✓ Ritirato
                            </button>
                          )}
                          {busta.metodo_consegna === 'consegna_domicilio' && (
                            <button
                              onClick={async () => {
                                await handleStatusUpdate({
                                  stato_consegna: 'consegnato',
                                  stato_attuale: 'consegnato_pagato'
                                });
                              }}
                              disabled={isSavingDelivery}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              ✓ Consegnato
                            </button>
                          )}
                          {busta.metodo_consegna === 'spedizione' && (
                            <>
                              <button
                                onClick={async () => {
                                  await handleStatusUpdate({
                                    stato_consegna: 'spedito'
                                  });
                                }}
                                disabled={isSavingDelivery}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                📦 Spedito
                              </button>
                              <button
                                onClick={async () => {
                                  await handleStatusUpdate({
                                    stato_consegna: 'arrivato',
                                    stato_attuale: 'consegnato_pagato'
                                  });
                                }}
                                disabled={isSavingDelivery}
                                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                ✓ Arrivato
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {busta.stato_consegna !== 'in_attesa' && busta.data_completamento_consegna && (
                        <div className="text-green-700 text-sm">
                          ✓ Completato il {new Date(busta.data_completamento_consegna).toLocaleDateString('it-IT')}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Nessuna modalità di consegna salvata. Imposta e salva le preferenze per abilitare il monitoraggio.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SHIPPING INFO (TRACKING & NOTES) - Only for Spedizione ===== */}
      {canEdit && isBustaReadyForNotification && busta.metodo_consegna === 'spedizione' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Informazioni Spedizione
          </h3>

          <div className="space-y-4">
            {/* Tracking Number */}
            <div>
              <label htmlFor="numero-tracking" className="block text-sm font-medium text-gray-700 mb-1">
                Numero Tracking
              </label>
              <input
                id="numero-tracking"
                type="text"
                value={numeroTracking}
                onChange={(e) => setNumeroTracking(e.target.value)}
                placeholder="Es: 1234567890ABC"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Codice di tracciamento fornito dal corriere
              </p>
            </div>

            {/* Shipping Notes */}
            <div>
              <label htmlFor="note-spedizione" className="block text-sm font-medium text-gray-700 mb-1">
                Note sulla Spedizione
              </label>
              <textarea
                id="note-spedizione"
                value={noteSpedizione}
                onChange={(e) => setNoteSpedizione(e.target.value)}
                rows={3}
                placeholder="Es: Pacco fragile, consegna solo a mano del destinatario..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Annotazioni utili per la gestione della spedizione
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveShippingInfo}
                disabled={isSavingDelivery || (numeroTracking === (busta.numero_tracking || '') && noteSpedizione === (busta.note_spedizione || ''))}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingDelivery ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva Informazioni Spedizione'
                )}
              </button>
            </div>

            {/* Display saved info if exists */}
            {(busta.numero_tracking || busta.note_spedizione) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Informazioni Salvate:</h4>
                {busta.numero_tracking && (
                  <p className="text-sm text-gray-700">
                    <strong>Tracking:</strong> {busta.numero_tracking}
                  </p>
                )}
                {busta.note_spedizione && (
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Note:</strong> {busta.note_spedizione}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ NUOVO: Messaggio informativo per operatori quando busta non è pronta */}
      {!canEdit && !isBustaReadyForNotification && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Comunicazioni non ancora disponibili</h3>
              <p className="text-sm text-blue-700">
                La busta deve essere nello stato "Pronto Ritiro" prima che i messaggi possano essere inviati.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ SEMPRE VISIBILE: Storico Comunicazioni - Completo per tutti */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Phone className="w-5 h-5 mr-2 text-gray-500" />
            Storico Comunicazioni
            {comunicazioni.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {comunicazioni.length}
              </span>
            )}
          </h3>
        </div>

        {isLoadingComunicazioni ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Caricamento comunicazioni...</p>
          </div>
        ) : comunicazioni.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nessuna comunicazione</h4>
            <p className="text-gray-500">
              {canEdit ? 
                'Non sono ancora stati inviati messaggi o note per questa busta' :
                'Non ci sono comunicazioni registrate per questa busta'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {comunicazioni.map((comunicazione) => (
              <div key={comunicazione.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isPhoneCallCommunication(comunicazione)
                          ? 'bg-red-100 text-red-800'
                          : comunicazione.tipo_messaggio === 'ordine_pronto'
                            ? 'bg-green-100 text-green-800'
                            : comunicazione.tipo_messaggio === 'sollecito_ritiro'
                              ? 'bg-orange-100 text-orange-800'
                              : comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isPhoneCallCommunication(comunicazione) ? (
                          <>
                            <PhoneCall className="w-3 h-3 mr-1" />
                            Telefonata
                          </>
                        ) : comunicazione.tipo_messaggio === 'ordine_pronto' ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ordine Pronto
                          </>
                        ) : comunicazione.tipo_messaggio === 'sollecito_ritiro' ? (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Sollecito
                          </>
                        ) : comunicazione.tipo_messaggio === 'nota_comunicazione_cliente' ? (
                          <>
                            <User className="w-3 h-3 mr-1" />
                            Nota Interna
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3 h-3 mr-1" />
                            {comunicazione.tipo_messaggio}
                          </>
                        )}
                      </span>
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="w-4 h-4 mr-1" />
                        <span>{comunicazione.nome_operatore}</span>
                      </div>
                    </div>
                    
                    {/* ✅ SEMPRE VISIBILE: Testo messaggio per tutti */}
                    <p className="text-gray-900 text-sm mb-2">
                      {comunicazione.testo_messaggio}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Inviato il {new Date(comunicazione.data_invio).toLocaleDateString('it-IT')} alle {new Date(comunicazione.data_invio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isPhoneCallCommunication(comunicazione)
                          ? 'bg-red-100 text-red-700'
                          : comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {isPhoneCallCommunication(comunicazione)
                          ? 'Telefono'
                          : comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                            ? 'Nota Interna'
                            : comunicazione.canale_invio?.toUpperCase() || 'SMS'}
                      </span>
                    </div>
                  </div>
                  {canEdit && comunicazione.tipo_messaggio === 'nota_comunicazione_cliente' && !isPhoneCallCommunication(comunicazione) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCommunication(comunicazione)}
                      className="ml-3 inline-flex items-center px-2 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                      title="Elimina nota interna"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
