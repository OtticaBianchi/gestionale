// app/dashboard/buste/[id]/_components/BustaDetailClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Calendar, 
  Package, 
  Clock, 
  FileText, 
  Edit3, 
  Save, 
  X,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShoppingCart,
  Plus,
  Truck,
  Factory,
  Eye
} from 'lucide-react';

type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
};

// Tipi per gli ordini materiali
type OrdineMateriale = {
  id: string;
  busta_id: string;
  fornitore_id?: string;
  tipo_ordine_id?: number;
  tipo_lenti_id?: string;
  descrizione_prodotto: string;
  data_ordine: string;
  giorni_consegna_medi?: number;
  data_consegna_prevista: string;
  data_consegna_effettiva?: string;
  stato: 'ordinato' | 'in_arrivo' | 'in_ritardo' | 'consegnato' | 'accettato_con_riserva' | 'rifiutato';
  giorni_ritardo: number;
  note?: string;
  created_at: string;
  updated_at: string;
  // Join data (aggiunti dalla query)
  fornitori?: { nome: string } | null;
  tipi_lenti?: { nome: string; giorni_consegna_stimati: number } | null;
  tipi_ordine?: { nome: string } | null;
  fornitore_nome?: string;
  tipo_lenti_nome?: string;
  tipo_ordine_nome?: string;
  emoji_stato?: string;
};

type Fornitore = {
  id: string;
  nome: string;
  // Nota: fornitori non ha tempi_consegna_medi nella struttura DB esistente
};

type TipoOrdine = {
  id: number;
  nome: string;
};

type TipoLenti = {
  id: string;
  nome: string;
  giorni_consegna_stimati: number;
};

interface BustaDetailClientProps {
  busta: BustaDettagliata;
}

export default function BustaDetailClient({ busta: initialBusta }: BustaDetailClientProps) {
  // ===== STATE MANAGEMENT =====
  const [busta, setBusta] = useState(initialBusta);
  const [activeTab, setActiveTab] = useState('anagrafica');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Tab 2 - Materiali state
  const [ordiniMateriali, setOrdiniMateriali] = useState<OrdineMateriale[]>([]);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [tipiOrdine, setTipiOrdine] = useState<TipoOrdine[]>([]);
  const [tipiLenti, setTipiLenti] = useState<TipoLenti[]>([]);
  const [showNuovoOrdineForm, setShowNuovoOrdineForm] = useState(false);
  const [isLoadingOrdini, setIsLoadingOrdini] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    // ✅ Dati busta
    tipo_lavorazione: busta.tipo_lavorazione || '',
    priorita: busta.priorita,
    note_generali: busta.note_generali || '',
    is_suspended: busta.is_suspended,
    // ✅ Dati cliente - ORA MODIFICABILI
    cliente_nome: busta.clienti?.nome || '',
    cliente_cognome: busta.clienti?.cognome || '',
    cliente_data_nascita: busta.clienti?.data_nascita || '',
    cliente_telefono: busta.clienti?.telefono || '',
    cliente_email: busta.clienti?.email || '',
    cliente_note: busta.clienti?.note_cliente || '',
  });

  // Nuovo ordine form
  const [nuovoOrdineForm, setNuovoOrdineForm] = useState({
    fornitore_id: '',
    tipo_ordine_id: '',
    tipo_lenti_id: '',
    descrizione_prodotto: '',
    data_ordine: new Date().toISOString().split('T')[0],
    giorni_consegna_custom: '',
    note: ''
  });

  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== LOAD DATA ON TAB CHANGE =====
  useEffect(() => {
    if (activeTab === 'materiali') {
      loadMaterialiData();
    }
  }, [activeTab]);

  // ===== LOAD MATERIALI DATA =====
  const loadMaterialiData = async () => {
    setIsLoadingOrdini(true);
    try {
      // Per ora mostriamo dati mock fino a quando non avremo i tipi aggiornati
      console.log('Loading materiali data per busta:', busta.id);
      
      // Simuliamo alcuni dati di esempio per il momento
      const mockOrdini: OrdineMateriale[] = [
        {
          id: 'mock-1',
          busta_id: busta.id,
          descrizione_prodotto: 'Lenti progressive Zeiss 1.67 antiriflesso',
          data_ordine: '2025-01-03',
          data_consegna_prevista: '2025-01-10',
          stato: 'in_ritardo' as const,
          giorni_ritardo: 2,
          created_at: '2025-01-03T10:00:00Z',
          updated_at: '2025-01-03T10:00:00Z',
          fornitore_nome: 'Luxottica',
          tipo_ordine_nome: 'Agente',
          emoji_stato: '⚠️'
        },
        {
          id: 'mock-2',
          busta_id: busta.id,
          descrizione_prodotto: 'Montatura Ray-Ban RB3025',
          data_ordine: '2025-01-03',
          data_consegna_prevista: '2025-01-08',
          data_consegna_effettiva: '2025-01-08',
          stato: 'consegnato' as const,
          giorni_ritardo: 0,
          created_at: '2025-01-03T10:00:00Z',
          updated_at: '2025-01-08T14:00:00Z',
          fornitore_nome: 'Safilo',
          tipo_ordine_nome: 'Email',
          emoji_stato: '✅'
        }
      ];

      // Usa i dati mock per ora
      setOrdiniMateriali(mockOrdini);

      // Load reference data se non già caricati
      if (fornitori.length === 0) {
        const [fornitoriData, tipiOrdineData, tipiLentiData] = await Promise.all([
          supabase.from('fornitori').select('*'),
          supabase.from('tipi_ordine').select('*'),
          supabase.from('tipi_lenti').select('*')
        ]);

        if (fornitoriData.data) setFornitori(fornitoriData.data);
        if (tipiOrdineData.data) setTipiOrdine(tipiOrdineData.data);
        if (tipiLentiData.data) {
          // Filter out entries with null giorni_consegna_stimati and provide default value
          const validTipiLenti = tipiLentiData.data
            .filter(item => item.giorni_consegna_stimati !== null)
            .map(item => ({
              ...item,
              giorni_consegna_stimati: item.giorni_consegna_stimati || 7 // Default to 7 days if somehow still null
            }));
          setTipiLenti(validTipiLenti);
        }
      }
    } catch (error) {
      console.error('Error loading materiali data:', error);
      setOrdiniMateriali([]);
    } finally {
      setIsLoadingOrdini(false);
    }
  };

  // ===== UTILITY FUNCTIONS =====
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDaysOpen = (dataApertura: string) => {
    const openDate = new Date(dataApertura);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - openDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatoColore = (stato: string) => {
    const colors: { [key: string]: string } = {
      'nuove': 'bg-blue-500',
      'materiali_ordinati': 'bg-orange-500',
      'materiali_parzialmente_arrivati': 'bg-yellow-500',
      'materiali_arrivati': 'bg-lime-500',
      'in_lavorazione': 'bg-purple-500',
      'pronto_ritiro': 'bg-green-500',
      'consegnato_pagato': 'bg-gray-500'
    };
    return colors[stato] || 'bg-gray-400';
  };

  // ===== CONTROLLO TIPO LENTI =====
  const shouldShowTipoLenti = () => {
    const tipoLav = editForm.tipo_lavorazione || busta.tipo_lavorazione;
    return tipoLav === 'OCV' || tipoLav === 'LV'; // Solo per occhiali vista completi o lenti vista
  };

  // ===== CALCOLO DATA CONSEGNA PREVISTA =====
  const calcolaDataConsegnaPrevista = () => {
    const dataOrdine = new Date(nuovoOrdineForm.data_ordine);
    let giorniConsegna = 7; // default

    if (nuovoOrdineForm.giorni_consegna_custom) {
      giorniConsegna = parseInt(nuovoOrdineForm.giorni_consegna_custom);
    } else if (nuovoOrdineForm.tipo_lenti_id) {
      const tipoLenti = tipiLenti.find(t => t.id === nuovoOrdineForm.tipo_lenti_id);
      giorniConsegna = tipoLenti?.giorni_consegna_stimati || 7;
    }
    // Nota: fornitori non ha tempi_consegna_medi, quindi usiamo default 7gg

    const dataConsegna = new Date(dataOrdine);
    dataConsegna.setDate(dataConsegna.getDate() + giorniConsegna);
    return dataConsegna.toISOString().split('T')[0];
  };

  // ===== HANDLE NUOVO ORDINE =====
  const handleSalvaNuovoOrdine = async () => {
    if (!nuovoOrdineForm.descrizione_prodotto.trim()) {
      alert('Descrizione prodotto obbligatoria');
      return;
    }

    try {
      console.log('Creazione nuovo ordine:', nuovoOrdineForm);
      
      // Per ora aggiungiamo un ordine mock all'elenco
      const nuovoOrdine: OrdineMateriale = {
        id: `mock-${Date.now()}`,
        busta_id: busta.id,
        descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
        data_ordine: nuovoOrdineForm.data_ordine,
        data_consegna_prevista: calcolaDataConsegnaPrevista(),
        stato: 'ordinato' as const,
        giorni_ritardo: 0,
        note: nuovoOrdineForm.note.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        fornitore_nome: fornitori.find(f => f.id === nuovoOrdineForm.fornitore_id)?.nome,
        tipo_ordine_nome: tipiOrdine.find(t => t.id.toString() === nuovoOrdineForm.tipo_ordine_id)?.nome,
        tipo_lenti_nome: tipiLenti.find(t => t.id === nuovoOrdineForm.tipo_lenti_id)?.nome,
        emoji_stato: '⏰'
      };

      // Aggiungi il nuovo ordine alla lista
      setOrdiniMateriali(prev => [nuovoOrdine, ...prev]);

      // Reset form
      setNuovoOrdineForm({
        fornitore_id: '',
        tipo_ordine_id: '',
        tipo_lenti_id: '',
        descrizione_prodotto: '',
        data_ordine: new Date().toISOString().split('T')[0],
        giorni_consegna_custom: '',
        note: ''
      });
      setShowNuovoOrdineForm(false);

      // Mostra messaggio di successo temporaneo
      alert('Ordine aggiunto con successo! (modalità demo)');

    } catch (error: any) {
      console.error('Error creating ordine:', error);
      alert(`Errore nella creazione: ${error.message}`);
    }
  };

  // ===== HANDLE TOGGLE ARRIVATO =====
  const handleToggleArrivato = async (ordineId: string, attualmenteArrivato: boolean) => {
    try {
      console.log('Toggle arrivato per ordine:', ordineId, attualmenteArrivato);
      
      // Aggiorna lo stato locale
      setOrdiniMateriali(prev => prev.map(ordine => {
        if (ordine.id === ordineId) {
          return {
            ...ordine,
            data_consegna_effettiva: attualmenteArrivato ? undefined : new Date().toISOString().split('T')[0],
            stato: attualmenteArrivato ? 'ordinato' as const : 'consegnato' as const,
            emoji_stato: attualmenteArrivato ? '⏰' : '✅',
            updated_at: new Date().toISOString()
          };
        }
        return ordine;
      }));

      // Mostra messaggio di successo temporaneo
      alert(`Ordine ${attualmenteArrivato ? 'rimesso in ordinato' : 'segnato come arrivato'}! (modalità demo)`);

    } catch (error: any) {
      console.error('Error updating ordine:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  // ===== EXISTING SAVE FUNCTION (Tab 1) =====
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // ✅ Validazione dati cliente
      if (!editForm.cliente_nome.trim() || !editForm.cliente_cognome.trim()) {
        throw new Error("Nome e cognome sono obbligatori");
      }

      // ✅ Gestione tipo_lavorazione
      const validWorkTypes = [
        'OCV', 'OV', 'OS', 'LV', 'LS', 'LAC', 'ACC', 'RIC', 'RIP', 
        'SA', 'SG', 'CT', 'ES', 'REL', 'FT'
      ] as const;
      
      let tipoLavorazioneValue: Database['public']['Enums']['work_type'] | null = null;
      
      if (editForm.tipo_lavorazione && editForm.tipo_lavorazione.trim() !== '') {
        if (validWorkTypes.includes(editForm.tipo_lavorazione as any)) {
          tipoLavorazioneValue = editForm.tipo_lavorazione as Database['public']['Enums']['work_type'];
        } else {
          throw new Error(`Tipo lavorazione non valido: ${editForm.tipo_lavorazione}`);
        }
      }

      console.log('🔍 Saving busta and client data...');

      // ✅ FIX: Aggiorna prima il cliente (se esiste)
      if (busta.clienti && busta.cliente_id) {
        const { error: clientError } = await supabase
          .from('clienti')
          .update({
            nome: editForm.cliente_nome.trim(),
            cognome: editForm.cliente_cognome.trim(),
            data_nascita: editForm.cliente_data_nascita || null,
            telefono: editForm.cliente_telefono.trim() || null,
            email: editForm.cliente_email.trim() || null,
            note_cliente: editForm.cliente_note.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', busta.cliente_id);

        if (clientError) {
          console.error('❌ Client update error:', clientError);
          throw new Error(`Errore aggiornamento cliente: ${clientError.message}`);
        }
      }

      // ✅ FIX: Aggiorna la busta (senza select per evitare errore multiple rows)
      const { error: bustaError } = await supabase
        .from('buste')
        .update({
          tipo_lavorazione: tipoLavorazioneValue,
          priorita: editForm.priorita,
          note_generali: editForm.note_generali.trim() || null,
          is_suspended: editForm.is_suspended,
          updated_at: new Date().toISOString()
        })
        .eq('id', busta.id);

      if (bustaError) {
        console.error('❌ Busta update error:', bustaError);
        throw new Error(`Errore aggiornamento busta: ${bustaError.message}`);
      }

      console.log('✅ Busta and client updated successfully');

      // ✅ Aggiorna lo stato locale
      setBusta(prev => ({
        ...prev,
        tipo_lavorazione: tipoLavorazioneValue,
        priorita: editForm.priorita,
        note_generali: editForm.note_generali.trim() || null,
        is_suspended: editForm.is_suspended,
        updated_at: new Date().toISOString(),
        clienti: prev.clienti ? {
          ...prev.clienti,
          nome: editForm.cliente_nome.trim(),
          cognome: editForm.cliente_cognome.trim(),
          data_nascita: editForm.cliente_data_nascita || null,
          telefono: editForm.cliente_telefono.trim() || null,
          email: editForm.cliente_email.trim() || null,
          note_cliente: editForm.cliente_note.trim() || null,
        } : null
      }));

      // ✅ SUCCESS
      setSaveSuccess(true);
      setIsEditing(false);

      // Reset success message dopo 3 secondi
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Errore nel salvataggio:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      tipo_lavorazione: busta.tipo_lavorazione || '',
      priorita: busta.priorita,
      note_generali: busta.note_generali || '',
      is_suspended: busta.is_suspended,
      cliente_nome: busta.clienti?.nome || '',
      cliente_cognome: busta.clienti?.cognome || '',
      cliente_data_nascita: busta.clienti?.data_nascita || '',
      cliente_telefono: busta.clienti?.telefono || '',
      cliente_email: busta.clienti?.email || '',
      cliente_note: busta.clienti?.note_cliente || '',
    });
    setIsEditing(false);
    setSaveSuccess(false);
  };

  // ===== TAB NAVIGATION =====
  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica & Lavorazione', icon: User },
    { id: 'materiali', label: 'Materiali & Ordini', icon: ShoppingCart },
    { id: 'lavorazione', label: 'Lavorazione', icon: Factory, disabled: true },
    { id: 'pagamento', label: 'Pagamento', icon: FileText, disabled: true },
    { id: 'comunicazioni', label: 'Comunicazioni', icon: Mail, disabled: true }
  ];

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Success Message */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Modifiche salvate con successo!</span>
        </div>
      )}

      {/* Header Busta */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Package className="w-7 h-7 mr-3 text-blue-600" />
                Busta #{busta.readable_id}
              </h1>
              <p className="text-gray-600 mt-1">
                {busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : 'Cliente non specificato'}
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                busta.priorita === 'critica' ? 'bg-red-100 text-red-800' :
                busta.priorita === 'urgente' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {busta.priorita.charAt(0).toUpperCase() + busta.priorita.slice(1)}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Stato: {busta.stato_attuale.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : tab.disabled
                        ? 'border-transparent text-gray-400 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                    disabled={tab.disabled}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.disabled && <span className="text-xs">(Prossimamente)</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'anagrafica' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna Principale */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Informazioni Cliente - ORA MODIFICABILI */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="h-5 w-5 mr-2 text-gray-500" />
                    Informazioni Cliente
                  </h2>
                  
                  {isEditing && (
                    <span className="text-sm text-blue-600 font-medium">Ora modificabile!</span>
                  )}
                </div>
                
                {busta.clienti ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Nome *</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.cliente_nome}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_nome: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      ) : (
                        <p className="text-lg font-medium text-gray-900">{busta.clienti.nome}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Cognome *</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.cliente_cognome}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_cognome: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      ) : (
                        <p className="text-lg font-medium text-gray-900">{busta.clienti.cognome}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Data di Nascita</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.cliente_data_nascita}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_data_nascita: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-gray-900">
                          {busta.clienti.data_nascita ? 
                            new Date(busta.clienti.data_nascita).toLocaleDateString('it-IT') : 
                            'Non specificata'
                          }
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Telefono</label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editForm.cliente_telefono}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="333 123 4567"
                        />
                      ) : (
                        busta.clienti.telefono ? (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{busta.clienti.telefono}</p>
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Non specificato</p>
                        )
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editForm.cliente_email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_email: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="email@example.com"
                        />
                      ) : (
                        busta.clienti.email ? (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <p className="text-gray-900">{busta.clienti.email}</p>
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Non specificata</p>
                        )
                      )}
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500">Note Cliente</label>
                      {isEditing ? (
                        <textarea
                          value={editForm.cliente_note}
                          onChange={(e) => setEditForm(prev => ({ ...prev, cliente_note: e.target.value }))}
                          rows={2}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="Note aggiuntive sul cliente..."
                        />
                      ) : (
                        <p className="text-gray-900 text-sm">
                          {busta.clienti.note_cliente || 'Nessuna nota'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Informazioni cliente non disponibili</p>
                )}
              </div>

              {/* Dettagli Lavorazione */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-gray-500" />
                    Dettagli Lavorazione
                  </h2>
                  
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Modifica</span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Salvataggio...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            <span>Salva</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                        <span>Annulla</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Tipo Lavorazione</label>
                    {isEditing ? (
                      <select
                        value={editForm.tipo_lavorazione}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tipo_lavorazione: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">-- Da specificare --</option>
                        <option value="OCV">👓 OCV - Occhiale da vista completo</option>
                        <option value="OV">👓 OV - Occhiale da vista</option>
                        <option value="OS">🕶️ OS - Occhiale da sole</option>
                        <option value="LV">🔍 LV - Lenti da vista</option>
                        <option value="LS">🌅 LS - Lenti da sole</option>
                        <option value="LAC">👁️ LAC - Lenti a contatto</option>
                        <option value="ACC">🔧 ACC - Accessori</option>
                        <option value="RIC">🔄 RIC - Ricambio</option>
                        <option value="RIP">🔨 RIP - Riparazione</option>
                        <option value="SA">📐 SA - Sagomatura</option>
                        <option value="SG">🧵 SG - Stringatura</option>
                        <option value="CT">👁️ CT - Controllo vista</option>
                        <option value="ES">🔬 ES - Esame specialistico</option>
                        <option value="REL">📋 REL - Relazione</option>
                        <option value="FT">🧾 FT - Fattura</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{busta.tipo_lavorazione || 'Da specificare'}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Priorità</label>
                    {isEditing ? (
                      <select
                        value={editForm.priorita}
                        onChange={(e) => setEditForm(prev => ({ ...prev, priorita: e.target.value as any }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="normale">Normale</option>
                        <option value="urgente">Urgente</option>
                        <option value="critica">Critica</option>
                      </select>
                    ) : (
                      <p className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        busta.priorita === 'critica' ? 'bg-red-100 text-red-800' :
                        busta.priorita === 'urgente' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {busta.priorita.charAt(0).toUpperCase() + busta.priorita.slice(1)}
                      </p>
                    )}
                  </div>
                  
                  {isEditing && (
                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editForm.is_suspended}
                          onChange={(e) => setEditForm(prev => ({ ...prev, is_suspended: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                          Busta sospesa
                        </span>
                      </label>
                    </div>
                  )}
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500">Note Generali</label>
                    {isEditing ? (
                      <textarea
                        value={editForm.note_generali}
                        onChange={(e) => setEditForm(prev => ({ ...prev, note_generali: e.target.value }))}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Note sulla lavorazione..."
                      />
                    ) : (
                      <p className="text-gray-900 text-sm">
                        {busta.note_generali || 'Nessuna nota'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Info Rapide */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-gray-500" />
                  Info Rapide
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Data Apertura</label>
                    <p className="text-gray-900">{formatDate(busta.data_apertura)}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Giorni Aperti</label>
                    <p className="text-lg font-semibold text-blue-600">
                      {calculateDaysOpen(busta.data_apertura)} giorni
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Creato da</label>
                    <p className="text-gray-900">{busta.profiles?.full_name || 'Utente sconosciuto'}</p>
                  </div>
                  
                  {busta.updated_at && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Ultimo Aggiornamento</label>
                      <p className="text-gray-900 text-sm">{formatDate(busta.updated_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline Stati */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-gray-500" />
                  Timeline Stati
                </h3>
                
                <div className="space-y-4">
                  {busta.status_history.map((entry, index) => (
                    <div key={entry.id} className="flex items-start space-x-3">
                      <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatoColore(entry.stato)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {entry.stato.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(entry.data_ingresso)}
                        </p>
                        {entry.profiles?.full_name && (
                          <p className="text-xs text-gray-400">
                            da {entry.profiles.full_name}
                          </p>
                        )}
                        {entry.note_stato && (
                          <p className="text-xs text-gray-600 mt-1">
                            {entry.note_stato}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MATERIALI & ORDINI */}
        {activeTab === 'materiali' && (
          <div className="space-y-6">
            
            {/* Header con pulsante nuovo ordine */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <ShoppingCart className="w-6 h-6 mr-3 text-green-600" />
                    Materiali & Ordini
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Gestione ordini presso fornitori per questa busta
                  </p>
                </div>
                <button
                  onClick={() => setShowNuovoOrdineForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuovo Ordine</span>
                </button>
              </div>
            </div>

            {/* Form Nuovo Ordine */}
            {showNuovoOrdineForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Nuovo Ordine</h3>
                  <button
                    onClick={() => setShowNuovoOrdineForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fornitore
                    </label>
                    <select
                      value={nuovoOrdineForm.fornitore_id}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, fornitore_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Seleziona fornitore --</option>
                      {fornitori.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modalità Ordine
                    </label>
                    <select
                      value={nuovoOrdineForm.tipo_ordine_id}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, tipo_ordine_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Seleziona modalità --</option>
                      {tipiOrdine.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo Lenti - solo per OCV e LV */}
                  {shouldShowTipoLenti() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Lenti <span className="text-blue-600 text-xs">(per lenti vista)</span>
                      </label>
                      <select
                        value={nuovoOrdineForm.tipo_lenti_id}
                        onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, tipo_lenti_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Seleziona tipo --</option>
                        {tipiLenti.map(tl => (
                          <option key={tl.id} value={tl.id}>
                            {tl.nome} ({tl.giorni_consegna_stimati}gg)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={shouldShowTipoLenti() ? "md:col-span-2 lg:col-span-3" : "md:col-span-1 lg:col-span-1"}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrizione Prodotto *
                    </label>
                    <input
                      type="text"
                      value={nuovoOrdineForm.descrizione_prodotto}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, descrizione_prodotto: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. Lenti progressive 1.67 antiriflesso..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Ordine
                    </label>
                    <input
                      type="date"
                      value={nuovoOrdineForm.data_ordine}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, data_ordine: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giorni Consegna Custom
                      <span className="text-xs text-gray-500 block">
                        (sovrascrivi default fornitore/tipo)
                      </span>
                    </label>
                    <input
                      type="number"
                      value={nuovoOrdineForm.giorni_consegna_custom}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, giorni_consegna_custom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. 5"
                      min="1"
                      max="90"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Consegna Prevista
                    </label>
                    <input
                      type="date"
                      value={calcolaDataConsegnaPrevista()}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Calcolata automaticamente</p>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note
                    </label>
                    <textarea
                      value={nuovoOrdineForm.note}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, note: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Note aggiuntive sull'ordine..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowNuovoOrdineForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSalvaNuovoOrdine}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Salva Ordine
                  </button>
                </div>
              </div>
            )}

            {/* Lista Ordini */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-gray-500" />
                  Ordini per questa Busta
                  {ordiniMateriali.length > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {ordiniMateriali.length}
                    </span>
                  )}
                </h3>
              </div>

              {isLoadingOrdini ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">Caricamento ordini...</p>
                </div>
              ) : ordiniMateriali.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun ordine ancora</h4>
                  <p className="text-gray-500 mb-4">
                    Inizia creando il primo ordine per questa busta
                  </p>
                  <button
                    onClick={() => setShowNuovoOrdineForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crea Primo Ordine
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {ordiniMateriali.map((ordine) => {
                    const isArrivato = ordine.stato === 'consegnato';
                    const giorniRitardo = ordine.giorni_ritardo || 0;
                    
                    return (
                      <div key={ordine.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900">
                                {ordine.descrizione_prodotto}
                              </h4>
                              
                              {/* Emoji Status Alert */}
                              <div className="flex items-center space-x-2">
                                <span className="text-xl" title={
                                  isArrivato ? 'Arrivato' :
                                  giorniRitardo > 2 ? `${giorniRitardo}gg di ritardo` :
                                  giorniRitardo > 0 ? 'In ritardo' : 'In tempo'
                                }>
                                  {ordine.emoji_stato || (
                                    isArrivato ? '✅' :
                                    giorniRitardo > 2 ? '🚨' :
                                    giorniRitardo > 0 ? '⚠️' : '⏰'
                                  )}
                                </span>
                                
                                {/* Stato Badge */}
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  ordine.stato === 'consegnato' ? 'bg-green-100 text-green-800' :
                                  ordine.stato === 'in_ritardo' ? 'bg-red-100 text-red-800' :
                                  ordine.stato === 'in_arrivo' ? 'bg-yellow-100 text-yellow-800' :
                                  ordine.stato === 'ordinato' ? 'bg-blue-100 text-blue-800' :
                                  ordine.stato === 'rifiutato' ? 'bg-gray-100 text-gray-800' :
                                  'bg-orange-100 text-orange-800'
                                }`}>
                                  {ordine.stato.replace(/_/g, ' ').toUpperCase()}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-2">
                                <Factory className="w-4 h-4 text-gray-400" />
                                <span>
                                  <strong>Fornitore:</strong> {ordine.fornitore_nome || 'Non specificato'}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span>
                                  <strong>Via:</strong> {ordine.tipo_ordine_nome || 'Non specificato'}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>
                                  <strong>Ordinato:</strong> {new Date(ordine.data_ordine).toLocaleDateString('it-IT')}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>
                                  <strong>Previsto:</strong> {new Date(ordine.data_consegna_prevista).toLocaleDateString('it-IT')}
                                </span>
                              </div>

                              {/* Tipo Lenti se presente */}
                              {ordine.tipo_lenti_nome && (
                                <div className="flex items-center space-x-2">
                                  <Eye className="w-4 h-4 text-gray-400" />
                                  <span>
                                    <strong>Tipo:</strong> {ordine.tipo_lenti_nome}
                                  </span>
                                </div>
                              )}

                              {/* Data consegna effettiva se arrivato */}
                              {ordine.data_consegna_effettiva && (
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span>
                                    <strong>Arrivato:</strong> {new Date(ordine.data_consegna_effettiva).toLocaleDateString('it-IT')}
                                  </span>
                                </div>
                              )}

                              {/* Alert ritardo se presente */}
                              {giorniRitardo > 0 && !isArrivato && (
                                <div className="flex items-center space-x-2">
                                  <AlertTriangle className={`w-4 h-4 ${giorniRitardo > 2 ? 'text-red-500' : 'text-yellow-500'}`} />
                                  <span className={giorniRitardo > 2 ? 'text-red-600 font-medium' : 'text-yellow-600 font-medium'}>
                                    {giorniRitardo} giorni di ritardo
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Note se presenti */}
                            {ordine.note && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                <p className="text-sm text-gray-700">
                                  <strong>Note:</strong> {ordine.note}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleToggleArrivato(ordine.id, isArrivato)}
                              className={`
                                px-3 py-1 rounded-md text-sm font-medium transition-colors
                                ${isArrivato 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }
                              `}
                            >
                              {isArrivato ? (
                                <>
                                  <CheckCircle className="w-4 h-4 inline mr-1" />
                                  Arrivato
                                </>
                              ) : (
                                <>
                                  <Package className="w-4 h-4 inline mr-1" />
                                  Segna Arrivato
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Riepilogo Ordini */}
            {ordiniMateriali.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {ordiniMateriali.length}
                    </div>
                    <div className="text-sm text-gray-500">Totale Ordini</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {ordiniMateriali.filter(o => o.stato === 'consegnato').length}
                    </div>
                    <div className="text-sm text-gray-500">Arrivati</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {ordiniMateriali.filter(o => o.stato === 'in_arrivo').length}
                    </div>
                    <div className="text-sm text-gray-500">In Arrivo</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {ordiniMateriali.filter(o => o.stato === 'in_ritardo').length}
                    </div>
                    <div className="text-sm text-gray-500">In Ritardo</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3, 4, 5 - Coming Soon */}
        {(activeTab === 'lavorazione' || activeTab === 'pagamento' || activeTab === 'comunicazioni') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🚧</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Tab in Sviluppo
              </h2>
              <p className="text-gray-600 mb-6">
                Questa sezione sarà disponibile nelle prossime versioni del sistema.
              </p>
              <button
                onClick={() => setActiveTab('anagrafica')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Torna a Anagrafica
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}