// ===== FILE: buste/[id]/_components/tabs/MaterialiTab.tsx =====
// 🔥 VERSIONE AGGIORNATA - CON CAMPO da_ordinare

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { 
  ShoppingCart,
  Plus,
  Truck,
  Factory,
  Eye,
  Trash2,
  X,
  Package,
  Calendar,
  Clock,
  Phone,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Check
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
};

// ✅ TIPO AGGIORNATO: Aggiunto da_ordinare
type OrdineMateriale = Database['public']['Tables']['ordini_materiali']['Row'] & {
  da_ordinare?: boolean | null; // ✅ NUOVO CAMPO
  fornitori_lenti?: { nome: string } | null;
  fornitori_lac?: { nome: string } | null;
  fornitori_montature?: { nome: string } | null;
  fornitori_sport?: { nome: string } | null;
  tipi_lenti?: { nome: string; giorni_consegna_stimati: number | null } | null;
  tipi_ordine?: { nome: string } | null;
};

type Fornitore = {
  id: string;
  nome: string;
};

type TipoOrdine = Database['public']['Tables']['tipi_ordine']['Row'];
type TipoLenti = Database['public']['Tables']['tipi_lenti']['Row'];

// Props del componente
interface MaterialiTabProps {
  busta: BustaDettagliata;
}

export default function MaterialiTab({ busta }: MaterialiTabProps) {
  // ===== STATE =====
  const [ordiniMateriali, setOrdiniMateriali] = useState<OrdineMateriale[]>([]);
  const [tipiOrdine, setTipiOrdine] = useState<TipoOrdine[]>([]);
  const [tipiLenti, setTipiLenti] = useState<TipoLenti[]>([]);
  
  // Fornitori specializzati per categoria
  const [fornitoriLenti, setFornitoriLenti] = useState<Fornitore[]>([]);
  const [fornitoriLac, setFornitoriLac] = useState<Fornitore[]>([]);
  const [fornitoriMontature, setFornitoriMontature] = useState<Fornitore[]>([]);
  const [fornitoriSport, setFornitoriSport] = useState<Fornitore[]>([]);
  
  const [showNuovoOrdineForm, setShowNuovoOrdineForm] = useState(false);
  const [isLoadingOrdini, setIsLoadingOrdini] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Nuovo ordine form con categorie
  const [nuovoOrdineForm, setNuovoOrdineForm] = useState({
    categoria_prodotto: '' as 'lenti' | 'lac' | 'montature' | 'sport' | '',
    fornitore_id: '',
    tipo_lenti: '',
    tipo_ordine_id: '',
    descrizione_prodotto: '',
    data_ordine: new Date().toISOString().split('T')[0],
    giorni_consegna_custom: '',
    note: ''
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== EFFECTS =====
  useEffect(() => {
    loadMaterialiData();
  }, [busta.id]);

  // ===== LOAD MATERIALI DATA =====
  const loadMaterialiData = async () => {
    setIsLoadingOrdini(true);
    try {
      console.log('🔍 Loading ordini materiali per busta:', busta.id);
      
      // 🔥 QUERY AGGIORNATA: Include da_ordinare
      const { data: ordiniData, error: ordiniError } = await supabase
        .from('ordini_materiali')
        .select(`
          *,
          fornitori_lenti:fornitori_lenti(nome),
          fornitori_lac:fornitori_lac(nome), 
          fornitori_montature:fornitori_montature(nome),
          fornitori_sport:fornitori_sport(nome),
          tipi_lenti:tipi_lenti(nome, giorni_consegna_stimati),
          tipi_ordine:tipi_ordine(nome)
        `)
        .eq('busta_id', busta.id)
        .order('created_at', { ascending: false });

      if (ordiniError) {
        console.error('❌ Errore caricamento ordini:', ordiniError);
        throw ordiniError;
      }

      console.log(`✅ Caricati ${ordiniData?.length || 0} ordini per busta ${busta.id}`);
      
      const ordiniTipizzati = (ordiniData || []).map(ordine => ({
        ...ordine,
        stato: ordine.stato || 'da_ordinare',
        da_ordinare: ordine.da_ordinare ?? true, // ✅ Default true se null
        tipi_lenti: ordine.tipi_lenti ? {
          ...ordine.tipi_lenti,
          giorni_consegna_stimati: ordine.tipi_lenti.giorni_consegna_stimati || 5
        } : null
      })) as OrdineMateriale[];
      
      setOrdiniMateriali(ordiniTipizzati);

      // Load reference data se non già caricati
      if (tipiOrdine.length === 0) {
        const [tipiOrdineData, tipiLentiData] = await Promise.all([
          supabase.from('tipi_ordine').select('*'),
          supabase.from('tipi_lenti').select('*').not('giorni_consegna_stimati', 'is', null)
        ]);

        if (tipiOrdineData.data) setTipiOrdine(tipiOrdineData.data);
        if (tipiLentiData.data) setTipiLenti(tipiLentiData.data);

        // ===== CARICA FORNITORI DALLE TABELLE SPECIALIZZATE =====
        const [fornitoriLentiData, fornitoriLacData, fornitoriMontaturaData, fornitoriSportData] = await Promise.all([
          supabase.from('fornitori_lenti').select('*'),
          supabase.from('fornitori_lac').select('*'),
          supabase.from('fornitori_montature').select('*'),
          supabase.from('fornitori_sport').select('*')
        ]);

        if (fornitoriLentiData.data) setFornitoriLenti(fornitoriLentiData.data);
        if (fornitoriLacData.data) setFornitoriLac(fornitoriLacData.data);
        if (fornitoriMontaturaData.data) setFornitoriMontature(fornitoriMontaturaData.data);
        if (fornitoriSportData.data) setFornitoriSport(fornitoriSportData.data);
      }
    } catch (error) {
      console.error('❌ Error loading materiali data:', error);
      setOrdiniMateriali([]);
    } finally {
      setIsLoadingOrdini(false);
    }
  };

  // ===== FORNITORI DISPONIBILI BASATI SU CATEGORIA =====
  const getFornitoriDisponibili = () => {
    switch (nuovoOrdineForm.categoria_prodotto) {
      case 'lenti': return fornitoriLenti;
      case 'lac': return fornitoriLac;
      case 'montature': return fornitoriMontature;
      case 'sport': return fornitoriSport;
      default: return [];
    }
  };

  // ===== TEMPI CONSEGNA PER CATEGORIA =====
  const getTempiConsegnaByCategoria = (categoria: string, tipoLenti?: string) => {
    if (categoria === 'lenti') {
      const tipoLentiDb = tipiLenti.find(t => t.id === tipoLenti);
      if (tipoLentiDb?.giorni_consegna_stimati) {
        return tipoLentiDb.giorni_consegna_stimati;
      }
    }
    
    const tempiDefault = {
      'lac': 3,
      'montature': 4,
      'sport': 5,
      'lenti': 5
    };
    
    return tempiDefault[categoria as keyof typeof tempiDefault] || 5;
  };

  // ===== CALCOLO DATA CONSEGNA PREVISTA =====
  const calcolaDataConsegnaPrevista = () => {
    const dataOrdine = new Date(nuovoOrdineForm.data_ordine);
    let giorniConsegna = 5;

    if (nuovoOrdineForm.giorni_consegna_custom) {
      giorniConsegna = parseInt(nuovoOrdineForm.giorni_consegna_custom);
    } else {
      giorniConsegna = getTempiConsegnaByCategoria(nuovoOrdineForm.categoria_prodotto, nuovoOrdineForm.tipo_lenti);
    }

    // Aggiungi solo giorni lavorativi (Lun-Sab)
    let dataConsegna = new Date(dataOrdine);
    let giorniAggiunti = 0;
    
    while (giorniAggiunti < giorniConsegna) {
      dataConsegna.setDate(dataConsegna.getDate() + 1);
      const giorno = dataConsegna.getDay();
      if (giorno >= 1 && giorno <= 6) {
        giorniAggiunti++;
      }
    }
    
    return dataConsegna.toISOString().split('T')[0];
  };

  // ===== HANDLE NUOVO ORDINE - ✅ AGGIORNATO CON da_ordinare =====
  const handleSalvaNuovoOrdine = async () => {
    if (!nuovoOrdineForm.descrizione_prodotto.trim()) {
      alert('Descrizione prodotto obbligatoria');
      return;
    }
    
    if (!nuovoOrdineForm.categoria_prodotto) {
      alert('Categoria prodotto obbligatoria');
      return;
    }

    setIsSaving(true);
    try {
      console.log('🔄 Creazione nuovo ordine con da_ordinare:', nuovoOrdineForm);
      
      // Determina la tabella fornitore e l'ID basato sulla categoria
      let fornitoreTableField = null;
      if (nuovoOrdineForm.fornitore_id) {
        switch (nuovoOrdineForm.categoria_prodotto) {
          case 'lenti':
            fornitoreTableField = { fornitore_lenti_id: nuovoOrdineForm.fornitore_id };
            break;
          case 'lac':
            fornitoreTableField = { fornitore_lac_id: nuovoOrdineForm.fornitore_id };
            break;
          case 'montature':
            fornitoreTableField = { fornitore_montature_id: nuovoOrdineForm.fornitore_id };
            break;
          case 'sport':
            fornitoreTableField = { fornitore_sport_id: nuovoOrdineForm.fornitore_id };
            break;
        }
      }

      // 🔥 INSERT CON da_ordinare = true DI DEFAULT
      const nuovoOrdineDb = {
        busta_id: busta.id,
        tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
        tipo_ordine_id: nuovoOrdineForm.tipo_ordine_id ? parseInt(nuovoOrdineForm.tipo_ordine_id) : null,
        descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
        data_ordine: nuovoOrdineForm.data_ordine,
        data_consegna_prevista: calcolaDataConsegnaPrevista(),
        giorni_consegna_medi: nuovoOrdineForm.giorni_consegna_custom 
          ? parseInt(nuovoOrdineForm.giorni_consegna_custom)
          : getTempiConsegnaByCategoria(nuovoOrdineForm.categoria_prodotto, nuovoOrdineForm.tipo_lenti),
        stato: 'da_ordinare' as const,
        da_ordinare: true, // ✅ NUOVO: Default da ordinare
        note: nuovoOrdineForm.note.trim() || null,
        ...fornitoreTableField
      };

      console.log('🔍 Dati inserimento con da_ordinare:', nuovoOrdineDb);

      const { data: ordineCreato, error } = await supabase
        .from('ordini_materiali')
        .insert(nuovoOrdineDb)
        .select(`
          *,
          fornitori_lenti:fornitori_lenti(nome),
          fornitori_lac:fornitori_lac(nome), 
          fornitori_montature:fornitori_montature(nome),
          fornitori_sport:fornitori_sport(nome),
          tipi_lenti:tipi_lenti(nome, giorni_consegna_stimati),
          tipi_ordine:tipi_ordine(nome)
        `)
        .single();

      if (error) {
        console.error('❌ Errore creazione ordine:', error);
        throw error;
      }

      console.log('✅ Ordine creato con da_ordinare:', ordineCreato);

      const ordineConTipiCorretti = {
        ...ordineCreato,
        stato: ordineCreato.stato || 'ordinato',
        da_ordinare: ordineCreato.da_ordinare ?? true, // ✅ Gestisce null
        tipi_lenti: ordineCreato.tipi_lenti ? {
          ...ordineCreato.tipi_lenti,
          giorni_consegna_stimati: ordineCreato.tipi_lenti.giorni_consegna_stimati || 5
        } : null
      } as OrdineMateriale;

      // Aggiorna la lista locale
      setOrdiniMateriali(prev => [ordineConTipiCorretti, ...prev]);

      // Reset form
      setNuovoOrdineForm({
        categoria_prodotto: '',
        fornitore_id: '',
        tipo_lenti: '',
        tipo_ordine_id: '',
        descrizione_prodotto: '',
        data_ordine: new Date().toISOString().split('T')[0],
        giorni_consegna_custom: '',
        note: ''
      });
      setShowNuovoOrdineForm(false);

      console.log('✅ Ordine con da_ordinare=true salvato nel database');

    } catch (error: any) {
      console.error('❌ Error creating ordine:', error);
      alert(`Errore nella creazione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ NUOVA FUNZIONE: Toggle da_ordinare
  const handleToggleDaOrdinare = async (ordineId: string, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;
      console.log(`🔄 Toggle da_ordinare per ${ordineId}: ${currentValue} → ${newValue}`);
      
      // 🔥 FIX: Quando da_ordinare diventa false → stato diventa "ordinato"
      const { error } = await supabase
        .from('ordini_materiali')
        .update({ 
          da_ordinare: newValue,
          stato: newValue ? 'da_ordinare' : 'ordinato', // ✅ SINCRONIZZAZIONE STATO
          // Se marca come "ordinato", aggiorna anche data_ordine
          data_ordine: !newValue ? new Date().toISOString().split('T')[0] : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', ordineId);
  
      if (error) {
        console.error('❌ Errore toggle da_ordinare:', error);
        throw error;
      }
  
      console.log('✅ da_ordinare E stato aggiornati nel database');
  
      // 🔥 FIX: Aggiorna stato locale con ENTRAMBI i campi
      setOrdiniMateriali(prev => prev.map(ordine => 
        ordine.id === ordineId 
          ? { 
              ...ordine, 
              da_ordinare: newValue,
              stato: newValue ? 'da_ordinare' : 'ordinato', // ✅ AGGIORNAMENTO LOCALE STATO
              data_ordine: !newValue ? new Date().toISOString().split('T')[0] : ordine.data_ordine
            }
          : ordine
      ));
  
    } catch (error: any) {
      console.error('❌ Error toggle da_ordinare:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  // ===== HANDLE AGGIORNA STATO ORDINE - VERSIONE ESISTENTE =====
  const handleAggiornaStatoOrdine = async (ordineId: string, nuovoStato: string) => {
    try {
      console.log('🔄 Aggiornamento stato ordine:', ordineId, nuovoStato);
      
      const updateData: any = {
        stato: nuovoStato,
        updated_at: new Date().toISOString()
      };

      // Se viene segnato come consegnato, aggiungi data consegna effettiva
      if (nuovoStato === 'consegnato') {
        updateData.data_consegna_effettiva = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('ordini_materiali')
        .update(updateData)
        .eq('id', ordineId);

      if (error) {
        console.error('❌ Errore aggiornamento stato:', error);
        throw error;
      }

      console.log('✅ Stato ordine aggiornato nel database');

      // Aggiorna stato locale
      setOrdiniMateriali(prev => prev.map(ordine => 
        ordine.id === ordineId 
          ? { ...ordine, ...updateData }
          : ordine
      ));

    } catch (error: any) {
      console.error('❌ Error updating ordine:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  // ===== HANDLE DELETE ORDINE - VERSIONE ESISTENTE =====
  const handleDeleteOrdine = async (ordineId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo ordine?')) {
      return;
    }

    try {
      console.log('🗑️ Eliminazione ordine:', ordineId);
      
      const { error } = await supabase
        .from('ordini_materiali')
        .delete()
        .eq('id', ordineId);

      if (error) {
        console.error('❌ Errore eliminazione ordine:', error);
        throw error;
      }

      console.log('✅ Ordine eliminato dal database');

      // Rimuovi dalla lista locale
      setOrdiniMateriali(prev => prev.filter(ordine => ordine.id !== ordineId));

    } catch (error: any) {
      console.error('❌ Error deleting ordine:', error);
      alert(`Errore eliminazione: ${error.message}`);
    }
  };

  // ===== RENDER =====
  return (
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
            <h3 className="text-lg font-semibold text-gray-900">Nuovo Ordine Materiale</h3>
            <button
              onClick={() => setShowNuovoOrdineForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
      
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* ===== STEP 1: CATEGORIA PRODOTTO ===== */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. Categoria Prodotto *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'lenti', label: '🔍 Lenti', desc: 'Lenti da vista/sole' },
                  { value: 'lac', label: '👁️ LAC', desc: 'Lenti a Contatto' },
                  { value: 'montature', label: '👓 Montature', desc: 'Occhiali/Sole' },
                  { value: 'sport', label: '🏃 Sport', desc: 'Articoli Sportivi' }
                ].map(categoria => (
                  <button
                    key={categoria.value}
                    onClick={() => setNuovoOrdineForm(prev => ({ 
                      ...prev, 
                      categoria_prodotto: categoria.value as any,
                      fornitore_id: '',
                      tipo_lenti: ''
                    }))}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      nuovoOrdineForm.categoria_prodotto === categoria.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{categoria.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{categoria.desc}</div>
                  </button>
                ))}
              </div>
            </div>
      
            {/* ===== STEP 2: TIPO LENTI (Solo per categoria 'lenti') ===== */}
            {nuovoOrdineForm.categoria_prodotto === 'lenti' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. Tipo Lenti *
                </label>
                <select
                  value={nuovoOrdineForm.tipo_lenti}
                  onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, tipo_lenti: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Seleziona tipo --</option>
                  {tipiLenti.map(tipo => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome} ({tipo.giorni_consegna_stimati || 5} giorni)
                    </option>
                  ))}
                </select>
              </div>
            )}
      
            {/* ===== STEP 3: FORNITORE SPECIFICO ===== */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {nuovoOrdineForm.categoria_prodotto === 'lenti' ? '3. Fornitore' : '2. Fornitore'}
              </label>
              <select
                value={nuovoOrdineForm.fornitore_id}
                onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, fornitore_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={!nuovoOrdineForm.categoria_prodotto}
              >
                <option value="">-- Seleziona fornitore --</option>
                {getFornitoriDisponibili().map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
      
            {/* ===== MODALITÀ ORDINE ===== */}
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
      
            {/* ===== DESCRIZIONE PRODOTTO OBBLIGATORIA ===== */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione Prodotto * <span className="text-red-500">(Obbligatorio)</span>
              </label>
              <textarea
                value={nuovoOrdineForm.descrizione_prodotto}
                onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, descrizione_prodotto: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Descrivi dettagliatamente il prodotto ordinato (es. Lenti progressive Zeiss 1.67 antiriflesso DuraVision, potere +2.00/-1.25x180°)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Inserire tutte le caratteristiche tecniche del prodotto
              </p>
            </div>
      
            {/* ===== GESTIONE DATE E TEMPI ===== */}
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
                  (sovrascrivi automatico)
                </span>
              </label>
              <input
                type="number"
                value={nuovoOrdineForm.giorni_consegna_custom}
                onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, giorni_consegna_custom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="es. 7"
                min="1"
                max="30"
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
              <p className="text-xs text-gray-500 mt-1">
                Calcolata su giorni lavorativi (Lun-Sab)
              </p>
            </div>
      
            {/* ===== NOTE RICERCABILI ===== */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Aggiuntive <span className="text-blue-600 text-xs">(ricercabili)</span>
              </label>
              <textarea
                value={nuovoOrdineForm.note}
                onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, note: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Note interne, solleciti, comunicazioni con fornitore..."
              />
            </div>
          </div>
      
          {/* ===== PULSANTI AZIONE ===== */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Riepilogo:</span> 
              {nuovoOrdineForm.categoria_prodotto && (
                <span className="ml-2">
                  {nuovoOrdineForm.categoria_prodotto.toUpperCase()}
                  {nuovoOrdineForm.tipo_lenti && ` - ${tipiLenti.find(t => t.id === nuovoOrdineForm.tipo_lenti)?.nome}`}
                  {nuovoOrdineForm.fornitore_id && ` | ${getFornitoriDisponibili().find(f => f.id === nuovoOrdineForm.fornitore_id)?.nome}`}
                </span>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowNuovoOrdineForm(false)}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSalvaNuovoOrdine}
                disabled={!nuovoOrdineForm.descrizione_prodotto.trim() || !nuovoOrdineForm.categoria_prodotto || isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salva Ordine</span>
                )}
              </button>
            </div>
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
              const oggi = new Date();
              const dataConsegnaPrevista = new Date(ordine.data_consegna_prevista);
              const statoOrdine = ordine.stato || 'ordinato';
              const giorniRitardo = statoOrdine !== 'consegnato' && oggi > dataConsegnaPrevista 
                ? Math.floor((oggi.getTime() - dataConsegnaPrevista.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              
              const isArrivato = statoOrdine === 'consegnato';
              const daOrdinare = ordine.da_ordinare ?? true;
              
              let nomeFornitore = 'Non specificato';
              if (ordine.fornitori_lenti?.nome) nomeFornitore = ordine.fornitori_lenti.nome;
              else if (ordine.fornitori_lac?.nome) nomeFornitore = ordine.fornitori_lac.nome;
              else if (ordine.fornitori_montature?.nome) nomeFornitore = ordine.fornitori_montature.nome;
              else if (ordine.fornitori_sport?.nome) nomeFornitore = ordine.fornitori_sport.nome;
              
              return (
                <div key={ordine.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {ordine.descrizione_prodotto}
                        </h4>
                        
                        <button
                          onClick={() => handleToggleDaOrdinare(ordine.id, daOrdinare)}
                          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            daOrdinare 
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                          title={daOrdinare ? 'Click per marcare come ordinato' : 'Click per marcare come da ordinare'}
                        >
                          {daOrdinare ? (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Da Ordinare</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Ordinato</span>
                            </>
                          )}
                        </button>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-xl" title={
                            isArrivato ? 'Arrivato' :
                            giorniRitardo > 2 ? `${giorniRitardo}gg di ritardo` :
                            giorniRitardo > 0 ? 'In ritardo' : 'In tempo'
                          }>
                            {isArrivato ? '✅' :
                             giorniRitardo > 2 ? '🚨' :
                             giorniRitardo > 0 ? '⚠️' : '⏰'}
                          </span>
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statoOrdine === 'consegnato' ? 'bg-green-100 text-green-800' :
                            statoOrdine === 'in_ritardo' ? 'bg-red-100 text-red-800' :
                            statoOrdine === 'in_arrivo' ? 'bg-yellow-100 text-yellow-800' :
                            statoOrdine === 'ordinato' ? 'bg-blue-100 text-blue-800' :
                            statoOrdine === 'da_ordinare' ? 'bg-purple-100 text-purple-800' :
                            statoOrdine === 'rifiutato' ? 'bg-gray-100 text-gray-800' :
                            'bg-orange-100 text-orange-800'
                            }`}>
                            {statoOrdine.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Factory className="w-4 h-4 text-gray-400" />
                          <span>
                            <strong>Fornitore:</strong> {nomeFornitore}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>
                            <strong>Via:</strong> {ordine.tipi_ordine?.nome || 'Non specificato'}
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

                        {ordine.tipi_lenti?.nome && (
                          <div className="flex items-center space-x-2">
                            <Eye className="w-4 h-4 text-gray-400" />
                            <span>
                              <strong>Tipo Lenti:</strong> {ordine.tipi_lenti.nome}
                            </span>
                          </div>
                        )}

                        {ordine.data_consegna_effettiva && (
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>
                              <strong>Arrivato:</strong> {new Date(ordine.data_consegna_effettiva).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}

                        {giorniRitardo > 0 && !isArrivato && (
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className={`w-4 h-4 ${giorniRitardo > 2 ? 'text-red-500' : 'text-yellow-500'}`} />
                            <span className={giorniRitardo > 2 ? 'text-red-600 font-medium' : 'text-yellow-600 font-medium'}>
                              {giorniRitardo} giorni di ritardo
                            </span>
                          </div>
                        )}
                      </div>

                      {ordine.note && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-700">
                            <strong>Note:</strong> {ordine.note}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2 ml-4">
                      <select
                        value={statoOrdine}
                        onChange={(e) => handleAggiornaStatoOrdine(ordine.id, e.target.value)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 focus:border-blue-500"
                      >
                        <option value="da_ordinare">🛒 Da Ordinare</option>
                        <option value="ordinato">📦 Ordinato</option>
                        <option value="in_arrivo">🚚 In Arrivo</option>
                        <option value="in_ritardo">⏰ In Ritardo</option>
                        <option value="accettato_con_riserva">🔄 Con Riserva</option>
                        <option value="rifiutato">❌ Rifiutato</option>
                        <option value="consegnato">✅ Consegnato</option>
                      </select>
                  
                      <button
                        onClick={() => handleDeleteOrdine(ordine.id)}
                        className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors border border-red-200"
                        title="Elimina ordine"
                      >
                        <span className="hidden md:block">Elimina</span>
                        <Trash2 className="w-4 h-4 md:hidden" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ordiniMateriali.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {ordiniMateriali.length}
              </div>
              <div className="text-sm text-gray-500">Totale Ordini</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {ordiniMateriali.filter(o => (o.da_ordinare ?? true) === true).length}
              </div>
              <div className="text-sm text-gray-500">Da Ordinare</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {ordiniMateriali.filter(o => (o.stato || 'ordinato') === 'consegnato').length}
              </div>
              <div className="text-sm text-gray-500">Arrivati</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {ordiniMateriali.filter(o => (o.stato || 'ordinato') === 'in_arrivo').length}
              </div>
              <div className="text-sm text-gray-500">In Arrivo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {ordiniMateriali.filter(o => (o.stato || 'ordinato') === 'in_ritardo').length}
              </div>
              <div className="text-sm text-gray-500">In Ritardo</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}