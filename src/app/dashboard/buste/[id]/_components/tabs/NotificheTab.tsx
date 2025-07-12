// ===== FILE: buste/[id]/_components/tabs/NotificheTab.tsx =====

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
  Phone
} from 'lucide-react';

// ===== TYPES LOCALI =====
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

// Usa il tipo dal database
type Comunicazione = Database['public']['Tables']['comunicazioni']['Row'];

// Props del componente
interface NotificheTabProps {
  busta: BustaDettagliata;
}

export default function NotificheTab({ busta }: NotificheTabProps) {
  // ===== STATE =====
  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [isLoadingComunicazioni, setIsLoadingComunicazioni] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== EFFECTS =====
  useEffect(() => {
    loadComunicazioni();
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

  // ===== LOAD COMUNICAZIONI =====
  const loadComunicazioni = async () => {
    setIsLoadingComunicazioni(true);
    try {
      console.log('🔍 Loading comunicazioni per busta:', busta.id);
      
      // 🔥 QUERY REALE: Carica comunicazioni dal database
      const { data: comunicazioniData, error } = await supabase
        .from('comunicazioni')
        .select('*')
        .eq('busta_id', busta.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Errore caricamento comunicazioni:', error);
        throw error;
      }

      console.log(`✅ Caricate ${comunicazioniData?.length || 0} comunicazioni per busta ${busta.id}`);
      setComunicazioni(comunicazioniData || []);

    } catch (error) {
      console.error('❌ Error loading comunicazioni:', error);
      setComunicazioni([]);
    } finally {
      setIsLoadingComunicazioni(false);
    }
  };

  // ===== GENERA TEMPLATE MESSAGGI =====
  const generaMessaggio = (tipo: 'ordine_pronto' | 'sollecito_ritiro') => {
    const nomeCliente = busta.clienti?.nome || 'Cliente';
    // ✅ FIX: Prende il nome (dopo lo spazio) invece del cognome
    const nomeOperatore = currentUser?.full_name?.split(' ').slice(1).join(' ') || 'Operatore';
    
    if (tipo === 'ordine_pronto') {
      return `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Il tuo acquisto è pronto e puoi passare a ritirarlo quando vuoi. Ti aspettiamo!`;
    } else {
      return `Ciao ${nomeCliente}, sono ${nomeOperatore} di Ottica Bianchi. Ti ricordo che il tuo acquisto è pronto e puoi venire a ritirarlo in negozio. Ti aspettiamo!`;
    }
  };

  // ===== INVIA MESSAGGIO =====
  const inviaMessaggio = async (tipo: 'ordine_pronto' | 'sollecito_ritiro') => {
    if (!currentUser || !busta.clienti) {
      alert('Dati mancanti per inviare il messaggio');
      return;
    }

    setIsSendingMessage(true);
    try {
      const testoMessaggio = generaMessaggio(tipo);
      
      console.log('📤 Registrazione messaggio:', { tipo, testo: testoMessaggio });

      // 🔥 SALVA NEL DATABASE con tutti i campi obbligatori
      const { data: nuovaComunicazione, error } = await supabase
        .from('comunicazioni')
        .insert({
          busta_id: busta.id,
          tipo_messaggio: tipo,
          testo_messaggio: testoMessaggio,
          data_invio: new Date().toISOString(),
          destinatario_tipo: 'cliente',
          destinatario_nome: `${busta.clienti.cognome} ${busta.clienti.nome}`,
          destinatario_contatto: busta.clienti.telefono,
          canale_invio: 'sms', // Default
          stato_invio: 'inviato',
          inviato_da: currentUser.id,
          nome_operatore: currentUser.full_name
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Errore salvataggio messaggio:', error);
        throw error;
      }

      console.log('✅ Messaggio registrato:', nuovaComunicazione);

      // Aggiorna lista locale
      setComunicazioni(prev => [nuovaComunicazione, ...prev]);

      // 🔄 TODO: QUI ANDRÀ L'INTEGRAZIONE SMS/WHATSAPP
      console.log('📱 PLACEHOLDER: Invio SMS/WhatsApp con testo:', testoMessaggio);

      // Feedback successo (temporaneo)
      alert(`✅ Messaggio "${tipo === 'ordine_pronto' ? 'Ordine Pronto' : 'Sollecito'}" registrato!\n\nTesto: ${testoMessaggio}\n\n📱 L'invio SMS/WhatsApp sarà attivato in futuro.`);

    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      alert(`Errore nell'invio: ${error.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // ===== VERIFICA SE BUSTA È IN STATO CORRETTO =====
  const isBustaReadyForNotification = busta.stato_attuale === 'pronto_ritiro';

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <MessageCircle className="w-6 h-6 mr-3 text-blue-600" />
              Notifiche & Ritiro
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Comunicazioni con il cliente per ritiro prodotti
            </p>
          </div>
          
          {/* Status indicator */}
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
            isBustaReadyForNotification 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isBustaReadyForNotification ? '✅ Pronto per Notifica' : '⏳ Non Ancora Pronto'}
          </div>
        </div>
      </div>

      {/* Azioni Invio Messaggi */}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Messaggio Ordine Pronto */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <Send className="w-4 h-4 mr-2 text-green-600" />
                Avvisa Ordine Pronto
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Notifica il cliente che i prodotti sono pronti per il ritiro
              </p>
              
              {/* Preview messaggio */}
              <div className="bg-gray-50 rounded-md p-3 mb-3">
                <p className="text-xs text-gray-700 italic">
                  {generaMessaggio('ordine_pronto')}
                </p>
              </div>
              
              <button
                onClick={() => inviaMessaggio('ordine_pronto')}
                disabled={isSendingMessage}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingMessage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Invio...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Invia Notifica
                  </>
                )}
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
              
              {/* Preview messaggio */}
              <div className="bg-gray-50 rounded-md p-3 mb-3">
                <p className="text-xs text-gray-700 italic">
                  {generaMessaggio('sollecito_ritiro')}
                </p>
              </div>
              
              <button
                onClick={() => inviaMessaggio('sollecito_ritiro')}
                disabled={isSendingMessage}
                className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingMessage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Invio...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Invia Sollecito
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Storico Comunicazioni */}
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
              Non sono ancora stati inviati messaggi per questa busta
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
                          : 'bg-orange-100 text-orange-800'
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
                    
                    <p className="text-gray-900 text-sm mb-2">
                      {comunicazione.testo_messaggio}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Inviato il {new Date(comunicazione.data_invio).toLocaleDateString('it-IT')} alle {new Date(comunicazione.data_invio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        comunicazione.canale_invio === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {comunicazione.canale_invio?.toUpperCase() || 'SMS'}
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