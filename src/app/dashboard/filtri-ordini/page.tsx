'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import Link from 'next/link';
import { 
  Package, 
  Phone, 
  Mail, 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  User,
  Calendar,
  FileText,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Filter
} from 'lucide-react';

// ===== TIPI PER ORDINI CON FORNITORI =====
type OrdineConFornitore = {
  id: string;
  descrizione_prodotto: string;
  stato: Database['public']['Enums']['ordine_status'] | null;
  da_ordinare: boolean | null;
  data_ordine: string;
  data_consegna_prevista: string;
  data_consegna_effettiva: string | null;
  giorni_ritardo: number | null;
  created_at: string;
  note: string | null;
  
  // Dati busta e cliente
  busta_readable_id: string;
  cliente_nome: string;
  cliente_cognome: string;
  cliente_telefono: string | null;
  busta_tipo_lavorazione: Database['public']['Enums']['work_type'] | null;
  
  // Fornitore (normalizzato dai campi esistenti)
  fornitore_nome: string | null;
  fornitore_tipo: 'lenti' | 'lac' | 'montature' | 'sport' | null;
  fornitore_telefono: string | null;
  fornitore_email: string | null;
  fornitore_note: string | null;
  fornitore_tempi_medi: number | null;
  
  // Altri dettagli
  tipo_lenti_nome: string | null;
  tipo_ordine_nome: string | null;
  
  // Campi calcolati per UX
  giorni_aperti: number;
  priorita: 'normale' | 'urgente';
};

type FornitoreRaggruppato = {
  nome: string;
  tipo: 'lenti' | 'lac' | 'montature' | 'sport';
  telefono: string | null;
  email: string | null;
  note: string | null;
  tempi_medi: number | null;
  metodo_ordine_derivato: 'telefono' | 'email' | 'misto';
  ordini: OrdineConFornitore[];
};

export default function FiltriOrdiniDashboard() {
  const [ordini, setOrdini] = useState<OrdineConFornitore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fornitoriFold, setFornitoriFold] = useState(new Set<string>());
  const [ordiniSelezionati, setOrdiniSelezionati] = useState(new Set<string>());
  const [modalitaDettagli, setModalitaDettagli] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== CARICAMENTO ORDINI DA ORDINARE =====
  const loadOrdiniDaOrdinare = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Caricamento ordini da ordinare...');
      
      // ✅ QUERY con schema database reale
      const { data: ordiniData, error } = await supabase
        .from('ordini_materiali')
        .select(`
          id,
          descrizione_prodotto,
          stato,
          da_ordinare,
          data_ordine,
          data_consegna_prevista,
          data_consegna_effettiva,
          giorni_ritardo,
          created_at,
          note,
          
          buste!inner(
            readable_id,
            tipo_lavorazione,
            clienti!inner(
              nome,
              cognome,
              telefono
            )
          ),
          
          fornitori_lenti(nome, telefono, email, note, tempi_consegna_medi),
          fornitori_lac(nome, telefono, email, note, tempi_consegna_medi),
          fornitori_montature(nome, telefono, email, note, tempi_consegna_medi),
          fornitori_sport(nome, telefono, email, note, tempi_consegna_medi),
          tipi_lenti(nome),
          tipi_ordine(nome)
        `)
        .eq('da_ordinare', true)  // ✅ FILTRO: Solo ordini da ordinare
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Errore query ordini:', error);
        throw error;
      }

      console.log(`✅ Caricati ${ordiniData?.length || 0} ordini da ordinare`);

      // ✅ NORMALIZZAZIONE: Unifica dati fornitori usando schema reale
      const ordiniNormalizzati: OrdineConFornitore[] = (ordiniData || []).map(ordine => {
        // Determina fornitore attivo e dati di contatto
        let fornitore_nome: string | null = null;
        let fornitore_tipo: 'lenti' | 'lac' | 'montature' | 'sport' | null = null;
        let fornitore_telefono: string | null = null;
        let fornitore_email: string | null = null;
        let fornitore_note: string | null = null;
        let fornitore_tempi_medi: number | null = null;

        // Controlla quale fornitore è collegato
        if (ordine.fornitori_lenti?.nome) {
          const f = ordine.fornitori_lenti;
          fornitore_nome = f.nome;
          fornitore_tipo = 'lenti';
          fornitore_telefono = f.telefono;
          fornitore_email = f.email;
          fornitore_note = f.note;
          fornitore_tempi_medi = f.tempi_consegna_medi;
        } else if (ordine.fornitori_lac?.nome) {
          const f = ordine.fornitori_lac;
          fornitore_nome = f.nome;
          fornitore_tipo = 'lac';
          fornitore_telefono = f.telefono;
          fornitore_email = f.email;
          fornitore_note = f.note;
          fornitore_tempi_medi = f.tempi_consegna_medi;
        } else if (ordine.fornitori_montature?.nome) {
          const f = ordine.fornitori_montature;
          fornitore_nome = f.nome;
          fornitore_tipo = 'montature';
          fornitore_telefono = f.telefono;
          fornitore_email = f.email;
          fornitore_note = f.note;
          fornitore_tempi_medi = f.tempi_consegna_medi;
        } else if (ordine.fornitori_sport?.nome) {
          const f = ordine.fornitori_sport;
          fornitore_nome = f.nome;
          fornitore_tipo = 'sport';
          fornitore_telefono = f.telefono;
          fornitore_email = f.email;
          fornitore_note = f.note;
          fornitore_tempi_medi = f.tempi_consegna_medi;
        }

        // Calcola giorni dalla creazione (gestisce null)
        const giorniAperti = ordine.created_at 
          ? Math.floor((Date.now() - new Date(ordine.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          id: ordine.id,
          descrizione_prodotto: ordine.descrizione_prodotto,
          stato: ordine.stato,
          da_ordinare: ordine.da_ordinare,
          data_ordine: ordine.data_ordine,
          data_consegna_prevista: ordine.data_consegna_prevista,
          data_consegna_effettiva: ordine.data_consegna_effettiva,
          giorni_ritardo: ordine.giorni_ritardo,
          created_at: ordine.created_at || '',
          note: ordine.note,
          
          // Dati busta e cliente
          busta_readable_id: ordine.buste?.readable_id || 'N/A',
          cliente_nome: ordine.buste?.clienti?.nome || 'N/A',
          cliente_cognome: ordine.buste?.clienti?.cognome || 'N/A',
          cliente_telefono: ordine.buste?.clienti?.telefono,
          busta_tipo_lavorazione: ordine.buste?.tipo_lavorazione,
          
          // Fornitore normalizzato
          fornitore_nome,
          fornitore_tipo,
          fornitore_telefono,
          fornitore_email,
          fornitore_note,
          fornitore_tempi_medi,
          
          // Altri dettagli
          tipo_lenti_nome: ordine.tipi_lenti?.nome || null,
          tipo_ordine_nome: ordine.tipi_ordine?.nome || null,
          
          // Campi calcolati per UX
          giorni_aperti: giorniAperti,
          priorita: giorniAperti > 5 ? 'urgente' : 'normale'
        };
      });

      setOrdini(ordiniNormalizzati);

    } catch (error) {
      console.error('❌ Error loading ordini:', error);
      setOrdini([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== BULK UPDATE: MARCA COME ORDINATI =====
  const markSelectedAsOrdered = async () => {
    if (ordiniSelezionati.size === 0) {
      alert('Seleziona almeno un ordine');
      return;
    }

    const selectedList = ordini.filter(o => ordiniSelezionati.has(o.id));
    const message = `Confermi di aver EFFETTIVAMENTE ordinato questi ${selectedList.length} materiali?\n\n` +
      selectedList.slice(0, 5).map(o => 
        `• ${o.descrizione_prodotto} - ${o.cliente_cognome} ${o.cliente_nome} (${o.fornitore_nome})`
      ).join('\n') +
      (selectedList.length > 5 ? `\n... e altri ${selectedList.length - 5}` : '');

    if (!confirm(message)) return;

    setIsBulkUpdating(true);
    try {
      console.log('🔄 Aggiornamento bulk ordini:', Array.from(ordiniSelezionati));
      
      const oggi = new Date().toISOString().split('T')[0];
      
      // ✅ UPDATE con sincronizzazione da_ordinare + stato
      const { error } = await supabase
        .from('ordini_materiali')
        .update({
          da_ordinare: false,           // Per dashboard filtri
          stato: 'ordinato',           // Per MaterialiTab e BustaCard
          data_ordine: oggi,
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(ordiniSelezionati));

      if (error) {
        console.error('❌ Errore bulk update:', error);
        throw error;
      }

      console.log('✅ Bulk update completato');
      alert(`✅ ${ordiniSelezionati.size} ordini marcati come ordinati!`);
      
      // Ricarica dati e reset selezioni
      await loadOrdiniDaOrdinare();
      setOrdiniSelezionati(new Set());

    } catch (error: any) {
      console.error('❌ Error bulk update:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // ===== RAGGRUPPA ORDINI PER FORNITORE =====
  const ordiniPerFornitore = ordini.reduce((acc, ordine) => {
    const nomeFornitore = ordine.fornitore_nome || 'FORNITORE NON SPECIFICATO';
    if (!acc[nomeFornitore]) {
      acc[nomeFornitore] = {
        nome: nomeFornitore,
        tipo: ordine.fornitore_tipo || 'lenti',
        telefono: ordine.fornitore_telefono,
        email: ordine.fornitore_email,
        note: ordine.fornitore_note,
        tempi_medi: ordine.fornitore_tempi_medi,
        // Deriva metodo ordine preferito dai campi disponibili
        metodo_ordine_derivato: ordine.fornitore_email && ordine.fornitore_telefono ? 'misto' :
                                ordine.fornitore_email ? 'email' : 'telefono',
        ordini: []
      };
    }
    acc[nomeFornitore].ordini.push(ordine);
    return acc;
  }, {} as Record<string, FornitoreRaggruppato>);

  // ===== UTILITY FUNCTIONS =====
  const toggleFornitore = (nomeFornitore: string) => {
    const newFold = new Set(fornitoriFold);
    if (newFold.has(nomeFornitore)) {
      newFold.delete(nomeFornitore);
    } else {
      newFold.add(nomeFornitore);
    }
    setFornitoriFold(newFold);
  };

  const toggleOrdineSelection = (ordineId: string) => {
    const newSelected = new Set(ordiniSelezionati);
    if (newSelected.has(ordineId)) {
      newSelected.delete(ordineId);
    } else {
      newSelected.add(ordineId);
    }
    setOrdiniSelezionati(newSelected);
  };

  const selezionaTuttoFornitore = (nomeFornitore: string) => {
    const ordiniFornitore = ordiniPerFornitore[nomeFornitore].ordini.map(o => o.id);
    const newSelected = new Set(ordiniSelezionati);
    const tuttiSelezionati = ordiniFornitore.every(id => newSelected.has(id));
    
    if (tuttiSelezionati) {
      ordiniFornitore.forEach(id => newSelected.delete(id));
    } else {
      ordiniFornitore.forEach(id => newSelected.add(id));
    }
    setOrdiniSelezionati(newSelected);
  };

  const getMetodoIcon = (metodo: string) => {
    switch (metodo) {
      case 'telefono': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'misto': return <Globe className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getMetodoLabel = (metodo: string) => {
    switch (metodo) {
      case 'telefono': return 'Telefono';
      case 'email': return 'Email';
      case 'misto': return 'Email + Tel';
      default: return 'Contatto';
    }
  };

  const getPrioritaStyle = (priorita: string, giorni: number) => {
    if (priorita === 'urgente') return 'bg-red-100 text-red-700 border-red-200';
    if (giorni > 5) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // ===== STATISTICHE =====
  const stats = {
    totaleFornitori: Object.keys(ordiniPerFornitore).length,
    totaleOrdini: ordini.length,
    ordiniUrgenti: ordini.filter(o => o.priorita === 'urgente').length,
    ordiniRitardo: ordini.filter(o => o.giorni_aperti > 5).length
  };

  // ===== EFFECTS =====
  useEffect(() => {
    loadOrdiniDaOrdinare();
  }, []);

  // ===== RENDER =====
  return (
    <>
      {/* Header con link di ritorno */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>← Torna alla Dashboard</span>
          </Link>
          <div className="flex items-center space-x-3">
            <Filter className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Dashboard Ordini</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Dashboard */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Package className="w-7 h-7 mr-3 text-blue-600" />
              Fai gli Ordini
            </h1>
            <p className="text-gray-600 mt-1">
              Ordina presso i fornitori e spunta come "ordinato" quando completato
            </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setModalitaDettagli(!modalitaDettagli)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {modalitaDettagli ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{modalitaDettagli ? 'Vista compatta' : 'Mostra dettagli'}</span>
              </button>
              
              <button
                onClick={loadOrdiniDaOrdinare}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                <span>Aggiorna</span>
              </button>
            </div>
          </div>

          {/* Stats rapide */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{stats.totaleFornitori}</div>
              <div className="text-sm text-blue-600">Fornitori coinvolti</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{stats.totaleOrdini}</div>
              <div className="text-sm text-green-600">Ordini da fare</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{stats.ordiniUrgenti}</div>
              <div className="text-sm text-red-600">Urgenti</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{stats.ordiniRitardo}</div>
              <div className="text-sm text-orange-600">In ritardo</div>
            </div>
          </div>
        </div>

        {/* Azioni rapide per selezioni */}
        {ordiniSelezionati.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 font-medium">
                {ordiniSelezionati.size} ordini selezionati
              </span>
              <div className="flex space-x-3">
                <button 
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  onClick={markSelectedAsOrdered}
                  disabled={isBulkUpdating}
                >
                  {isBulkUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Marca come Ordinati</span>
                </button>
                <button 
                  onClick={() => setOrdiniSelezionati(new Set())}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isBulkUpdating}
                >
                  Deseleziona tutto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Caricamento ordini da ordinare...</p>
          </div>
        ) : ordini.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun ordine da ordinare</h4>
            <p className="text-gray-500">
              Tutti gli ordini sono già stati gestiti! 🎉
            </p>
          </div>
        ) : (
          /* Lista fornitori con ordini */
          <div className="space-y-4">
            {Object.entries(ordiniPerFornitore).map(([nomeFornitore, fornitore]) => {
              const isExpanded = !fornitoriFold.has(nomeFornitore);
              const ordiniSelezionatiFornitore = fornitore.ordini.filter(o => ordiniSelezionati.has(o.id)).length;
              const tuttiSelezionati = ordiniSelezionatiFornitore === fornitore.ordini.length;
              const ordiniUrgenti = fornitore.ordini.filter(o => o.priorita === 'urgente').length;
              const ordiniRitardo = fornitore.ordini.filter(o => o.giorni_aperti > 5).length;
              
              return (
                <div key={nomeFornitore} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {/* Header fornitore */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => toggleFornitore(nomeFornitore)}
                          className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          {isExpanded ? 
                            <ChevronDown className="w-5 h-5 text-gray-500" /> : 
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          }
                          <div className="text-left">
                            <div className="font-semibold text-lg text-gray-900 flex items-center">
                              {getMetodoIcon(fornitore.metodo_ordine_derivato)}
                              <span className="ml-2">{nomeFornitore}</span>
                              <span className="ml-2 text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {fornitore.ordini.length} ordini
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 flex items-center space-x-4">
                              <span>{getMetodoLabel(fornitore.metodo_ordine_derivato)}</span>
                              {fornitore.telefono && (
                                <span className="flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {fornitore.telefono}
                                </span>
                              )}
                              {fornitore.email && (
                                <span className="flex items-center">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {fornitore.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        
                        {/* Badges di stato */}
                        <div className="flex space-x-2">
                          {ordiniUrgenti > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                              ⚠️ {ordiniUrgenti} urgenti
                            </span>
                          )}
                          {ordiniRitardo > 0 && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
                              ⏰ {ordiniRitardo} in ritardo
                            </span>
                          )}
                          {fornitore.tempi_medi && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                              📅 {fornitore.tempi_medi}gg medi
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {ordiniSelezionatiFornitore > 0 && (
                          <span className="text-sm text-blue-600">
                            {ordiniSelezionatiFornitore}/{fornitore.ordini.length} selezionati
                          </span>
                        )}
                        
                        <button
                          onClick={() => selezionaTuttoFornitore(nomeFornitore)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            tuttiSelezionati 
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tuttiSelezionati ? 'Deseleziona tutto' : 'Seleziona tutto'}
                        </button>

                        {/* Azioni rapide fornitore */}
                        <div className="flex space-x-2">
                          {fornitore.telefono && (
                            <a 
                              href={`tel:${fornitore.telefono}`}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Chiama</span>
                            </a>
                          )}
                          {fornitore.email && (
                            <a 
                              href={`mailto:${fornitore.email}?subject=Ordine materiali - ${new Date().toLocaleDateString('it-IT')}&body=Buongiorno,%0A%0AVorrei ordinare i seguenti materiali:%0A%0A${fornitore.ordini.map(o => `- ${o.descrizione_prodotto} (Busta ${o.busta_readable_id} - ${o.cliente_cognome} ${o.cliente_nome})`).join('%0A')}`}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Email</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Note fornitore */}
                    {fornitore.note && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        💡 {fornitore.note}
                      </div>
                    )}
                  </div>

                  {/* Lista ordini (expandibile) */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {fornitore.ordini.map((ordine) => (
                        <div 
                          key={ordine.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            ordiniSelezionati.has(ordine.id) 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <input
                                type="checkbox"
                                checked={ordiniSelezionati.has(ordine.id)}
                                onChange={() => toggleOrdineSelection(ordine.id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                              
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <span className="font-medium text-gray-900">
                                    Busta {ordine.busta_readable_id}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs border ${getPrioritaStyle(ordine.priorita, ordine.giorni_aperti)}`}>
                                    {ordine.priorita === 'urgente' ? '⚠️ URGENTE' : 
                                     ordine.giorni_aperti > 5 ? '⏰ RITARDO' : '📋 Normale'}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {ordine.giorni_aperti} giorni fa
                                  </span>
                                </div>
                                
                                <div className="mt-1 text-sm text-gray-600 flex items-center space-x-4">
                                  <span className="flex items-center">
                                    <User className="w-3 h-3 mr-1" />
                                    {ordine.cliente_cognome} {ordine.cliente_nome}
                                  </span>
                                  {ordine.cliente_telefono && (
                                    <span className="flex items-center">
                                      <Phone className="w-3 h-3 mr-1" />
                                      {ordine.cliente_telefono}
                                    </span>
                                  )}
                                  {ordine.busta_tipo_lavorazione && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      {ordine.busta_tipo_lavorazione}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="mt-2 font-medium text-gray-900">
                                  {ordine.descrizione_prodotto}
                                </div>
                                
                                {ordine.note && (
                                  <div className="mt-1 text-sm text-gray-500 italic">
                                    "Note: {ordine.note}"
                                  </div>
                                )}
                                
                                {modalitaDettagli && (
                                  <div className="mt-2 text-xs text-gray-500 flex items-center space-x-3">
                                    <span className="flex items-center">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Creato: {new Date(ordine.created_at).toLocaleDateString('it-IT')}
                                    </span>
                                    {ordine.data_consegna_prevista && (
                                      <span className="flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Previsto: {new Date(ordine.data_consegna_prevista).toLocaleDateString('it-IT')}
                                      </span>
                                    )}
                                    {ordine.tipo_lenti_nome && (
                                      <span>Tipo: {ordine.tipo_lenti_nome}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer informativo */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <span>💡 <strong>Suggerimento:</strong> Raggruppa per fornitore per ordinazioni più efficienti</span>
              <span>📞 Usa i link diretti per telefonare o mandare email</span>
            </div>
            <div className="text-xs">
              Ultimo aggiornamento: {new Date().toLocaleString('it-IT')}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}