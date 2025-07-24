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
  Eye,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';

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
};

type Comunicazione = Database['public']['Tables']['comunicazioni']['Row'];

interface NotificheTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean;
}

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

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Carica comunicazioni e utente all'avvio/cambio busta
  useEffect(() => {
    loadComunicazioni();
    getCurrentUser();
  }, [busta.id]);

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
        .order('created_at', { ascending: false });
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

  // Invio messaggio o nota
  const inviaMessaggio = async (tipo: 'ordine_pronto' | 'sollecito_ritiro' | 'nota_comunicazione_cliente', testoCustom?: string) => {
    if (!currentUser) {
      alert('Dati operatore mancanti.');
      return;
    }
    if (tipo !== 'nota_comunicazione_cliente' && !busta.clienti) {
      alert('Dati cliente mancanti.');
      return;
    }
    const testoFinale = testoCustom ?? (tipo === 'nota_comunicazione_cliente' ? freeNote : generaMessaggio(tipo));
    if (!testoFinale.trim()) {
      alert('Il testo non può essere vuoto.');
      return;
    }

    setIsSendingMessage(true);
    try {
      const { data: nuovaComunicazione, error } = await supabase
        .from('comunicazioni')
        .insert({
          busta_id: busta.id,
          tipo_messaggio: tipo,
          testo_messaggio: testoFinale,
          data_invio: new Date().toISOString(),
          destinatario_tipo: "cliente",
          destinatario_nome: busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : "",
          destinatario_contatto: busta.clienti?.telefono ?? "",
          canale_invio: 'whatsapp',
          stato_invio: 'inviato',
          inviato_da: currentUser.id,
          nome_operatore: currentUser.full_name
        })
        .select()
        .single();
      if (error) throw error;
      setComunicazioni(prev => [nuovaComunicazione, ...prev]);
      setEditingMessageType(null);
      setCustomMessage('');
      setFreeNote('');
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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
                    Es: "È passato il marito", "Avvertito via WhatsApp personale", "Cliente chiamato telefonicamente"
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
            </div>
          )}
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
                        comunicazione.tipo_messaggio === 'ordine_pronto'
                          ? 'bg-green-100 text-green-800'
                          : comunicazione.tipo_messaggio === 'sollecito_ritiro'
                            ? 'bg-orange-100 text-orange-800'
                            : comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}>
                        {comunicazione.tipo_messaggio === 'ordine_pronto' ? (
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
                        comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                          ? 'bg-gray-100 text-gray-700'
                          : comunicazione.canale_invio === 'whatsapp'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {comunicazione.tipo_messaggio === 'nota_comunicazione_cliente'
                          ? 'Nota Interna'
                          : comunicazione.canale_invio?.toUpperCase() || 'WHATSAPP'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}