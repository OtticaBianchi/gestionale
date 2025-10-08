// ===== FILE: buste/[id]/_components/tabs/MaterialiTab.tsx =====
// 🔥 VERSIONE AGGIORNATA - CON CAMPO da_ordinare + READ-ONLY MODE

'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
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
  Check,
  Euro,
  Save
} from 'lucide-react';
import type { WorkflowState } from '@/app/dashboard/_components/WorkflowLogic';
import { areAllOrdersCancelled } from '@/lib/buste/archiveRules';

// ===== TYPES LOCALI =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
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

// ✅ TIPO AGGIORNATO: Aggiunto da_ordinare
type OrdineMateriale = Database['public']['Tables']['ordini_materiali']['Row'] & {
  da_ordinare?: boolean | null; // ✅ NUOVO CAMPO
  fornitori_lenti?: { nome: string } | null;
  fornitori_lac?: { nome: string } | null;
  fornitori_montature?: { nome: string } | null;
  fornitori_lab_esterno?: { nome: string } | null;
  fornitori_sport?: { nome: string } | null;
  tipi_lenti?: { nome: string; giorni_consegna_stimati: number | null } | null;
  tipi_ordine?: { nome: string } | null;
  prezzo_prodotto?: number | null;
};

type Fornitore = {
  id: string;
  nome: string;
};

type TipoOrdine = Database['public']['Tables']['tipi_ordine']['Row'];
type TipoLenti = Database['public']['Tables']['tipi_lenti']['Row'];
type AutoAdvanceState = 'nuove' | 'materiali_ordinati' | 'materiali_arrivati';
type AutoAdvanceTarget = 'materiali_ordinati' | 'materiali_arrivati';
const MANAGED_WORKFLOW_STATES: readonly AutoAdvanceState[] = ['nuove', 'materiali_ordinati', 'materiali_arrivati'] as const;
const WORKFLOW_STATES: readonly WorkflowState[] = [
  'nuove',
  'materiali_ordinati',
  'materiali_arrivati',
  'in_lavorazione',
  'pronto_ritiro',
  'consegnato_pagato'
] as const;

const resolveWorkflowState = (state: string): WorkflowState =>
  (WORKFLOW_STATES.includes(state as WorkflowState) ? (state as WorkflowState) : 'nuove');

// Props del componente
interface MaterialiTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean; // ✅ AGGIUNTO
  canDelete?: boolean; // ✅ Solo admin possono cancellare ordini
}                                                                                                            

export default function MaterialiTab({ busta, isReadOnly = false, canDelete = false }: MaterialiTabProps) {
  // ===== STATE =====
  const [ordiniMateriali, setOrdiniMateriali] = useState<OrdineMateriale[]>([]);
  const [tipiOrdine, setTipiOrdine] = useState<TipoOrdine[]>([]);
  const [tipiLenti, setTipiLenti] = useState<TipoLenti[]>([]);
  
  // Fornitori specializzati per categoria
  const [fornitoriLenti, setFornitoriLenti] = useState<Fornitore[]>([]);
  const [fornitoriLac, setFornitoriLac] = useState<Fornitore[]>([]);
  const [fornitoriMontature, setFornitoriMontature] = useState<Fornitore[]>([]);
  const [fornitoriLabEsterno, setFornitoriLabEsterno] = useState<Fornitore[]>([]);
  const [fornitoriSport, setFornitoriSport] = useState<Fornitore[]>([]);
  const [fornitoriAccessori, setFornitoriAccessori] = useState<Fornitore[]>([]); // ✅ NUOVO: Accessori
  
  const [showNuovoOrdineForm, setShowNuovoOrdineForm] = useState(false);
  const [isLoadingOrdini, setIsLoadingOrdini] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowState>(resolveWorkflowState(busta.stato_attuale));

  // ✅ NUOVO: State per acconto (down payment) della busta
  const [accontoInfo, setAccontoInfo] = useState({
    importo_acconto: '',
    ha_acconto: false,
    currentAcconto: null as number | null
  });


  // ✅ AGGIUNTO: Helper per controlli
  const canEdit = !isReadOnly;

  // Nuovo ordine form con categorie
  const [nuovoOrdineForm, setNuovoOrdineForm] = useState({
    categoria_prodotto: '' as 'lenti' | 'lac' | 'montature' | 'lab.esterno' | 'sport' | 'accessori' | '', // ✅ AGGIUNTO: accessori
    fornitore_id: '',
    tipo_lenti: '',
    tipo_ordine_id: '',
    descrizione_prodotto: '',
    data_ordine: new Date().toISOString().split('T')[0],
    giorni_consegna_custom: '',
    note: '',
    primo_acquisto_lac: false
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setWorkflowStatus(resolveWorkflowState(busta.stato_attuale));
  }, [busta.stato_attuale]);

  const autoAdvanceBusta = async (
    oldStatus: AutoAdvanceState,
    newStatus: AutoAdvanceTarget,
    context: string
  ): Promise<boolean> => {
    console.log(`🔄 Auto-advance (${context}): ${oldStatus} → ${newStatus}`);
    try {
      const response = await fetch('/api/buste/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bustaId: busta.id,
          oldStatus,
          newStatus
        })
      });

      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.warn('⚠️ Auto-advance: impossibile leggere l\'errore di risposta', parseError);
        }
        console.warn(`⚠️ Auto-advance fallito (${context}):`, errorData);
        return false;
      }

      console.log(`✅ Auto-advance completato (${context})`);
      setWorkflowStatus(newStatus);
      await mutate('/api/buste');
      return true;
    } catch (autoAdvanceError) {
      console.error(`❌ Errore auto-advance (${context}):`, autoAdvanceError);
      return false;
    }
  };

  const syncBustaWorkflowWithOrdini = async (ordini: OrdineMateriale[], context: string) => {
    if (ordini.length === 0) return;

    if (areAllOrdersCancelled(ordini)) {
      console.log(`📁 Archiviazione automatica (${context}): tutti gli ordini sono stati annullati`);
      setWorkflowStatus('materiali_ordinati');
      await mutate('/api/buste');
      return;
    }

    const tuttiPronti = ordini.every(ordinePronto);
    const desiredStatus: AutoAdvanceTarget = tuttiPronti ? 'materiali_arrivati' : 'materiali_ordinati';

    const currentWorkflow = workflowStatus;
    const isManagedCurrent = MANAGED_WORKFLOW_STATES.includes(currentWorkflow as AutoAdvanceState);

    if (isManagedCurrent && currentWorkflow === desiredStatus) {
      return;
    }

    if (!isManagedCurrent) {
      return;
    }

    const attemptsQueue: AutoAdvanceState[] = [
      currentWorkflow as AutoAdvanceState
    ];

    if (desiredStatus === 'materiali_ordinati') {
      attemptsQueue.push('materiali_arrivati', 'nuove');
    } else {
      attemptsQueue.push('materiali_ordinati', 'nuove');
    }

    const attempted = new Set<AutoAdvanceState>();

    for (const fromState of attemptsQueue) {
      if (!MANAGED_WORKFLOW_STATES.includes(fromState)) continue;
      if (fromState === desiredStatus) continue;
      if (attempted.has(fromState)) continue;
      attempted.add(fromState);

      const success = await autoAdvanceBusta(fromState, desiredStatus, `${context} (sync stato busta)`);
      if (success) {
        break;
      }
    }
  };

  // ===== HELPER FUNCTIONS =====

  // Check se ordine è "da negozio" (già in stock)
  const isDaNegozio = (ordine: OrdineMateriale): boolean => {
    return ordine.tipi_ordine?.nome?.toLowerCase() === 'negozio';
  };

  // Check se ordine è "pronto" per avanzamento busta
  const ordinePronto = (ordine: OrdineMateriale): boolean => {
    return isDaNegozio(ordine) ||  // Prodotto già a negozio
           ordine.stato === 'consegnato' ||
           ordine.stato === 'accettato_con_riserva';
  };

  // ✅ REMOVED: No more automatic price calculation
  // Price is now manually entered in PagamentoTab

  // ===== EFFECTS =====
  useEffect(() => {
    loadMaterialiData();
    loadAccontoInfo(); // ✅ CARICA INFO ACCONTO
  }, [busta.id]);

  // ✅ NUOVO EFFECT: Auto-aggiornamento ordini "in arrivo"
  useEffect(() => {
    if (ordiniMateriali.length > 0 && canEdit) {
      // Controlla se ci sono ordini che dovrebbero essere in arrivo prima di chiamare l'aggiornamento
      const ordiniDaAggiornare = ordiniMateriali.filter(dovrebbeEssereInArrivo);
      if (ordiniDaAggiornare.length > 0) {
        console.log(`🔍 Controllo automatico: ${ordiniDaAggiornare.length} ordini pronti per "in_arrivo"`);
        aggiornaOrdiniInArrivo();
      }
    }
  }, [ordiniMateriali.length, canEdit]); // Trigger quando cambiano ordini o permessi

  // ✅ NUOVO EFFECT: Auto-aggiornamento ordini "in ritardo"
  useEffect(() => {
    if (ordiniMateriali.length > 0 && canEdit) {
      // Controlla se ci sono ordini che dovrebbero essere in ritardo
      const ordiniDaAggiornare = ordiniMateriali.filter(dovrebbeEssereInRitardo);
      if (ordiniDaAggiornare.length > 0) {
        console.log(`⚠️ Controllo automatico: ${ordiniDaAggiornare.length} ordini in ritardo`);
        aggiornaOrdiniInRitardo();
      }
    }
  }, [ordiniMateriali.length, canEdit]); // Trigger quando cambiano ordini o permessi


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
          fornitori_lab_esterno:fornitori_lab_esterno(nome),
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
        da_ordinare: ordine.da_ordinare ?? true,
        tipi_lenti: ordine.tipi_lenti && typeof ordine.tipi_lenti === 'object' && 'nome' in ordine.tipi_lenti
          ? {
              ...ordine.tipi_lenti,
              giorni_consegna_stimati: ordine.tipi_lenti.giorni_consegna_stimati || 5
            }
          : null,
        fornitori_lab_esterno: ordine.fornitori_lab_esterno && typeof ordine.fornitori_lab_esterno === 'object' && 'nome' in ordine.fornitori_lab_esterno
          ? ordine.fornitori_lab_esterno
          : null,
        fornitori_lenti: ordine.fornitori_lenti && typeof ordine.fornitori_lenti === 'object' && 'nome' in ordine.fornitori_lenti
          ? ordine.fornitori_lenti
          : null,
        fornitori_lac: ordine.fornitori_lac && typeof ordine.fornitori_lac === 'object' && 'nome' in ordine.fornitori_lac
          ? ordine.fornitori_lac
          : null,
        fornitori_montature: ordine.fornitori_montature && typeof ordine.fornitori_montature === 'object' && 'nome' in ordine.fornitori_montature
          ? ordine.fornitori_montature
          : null,
        fornitori_sport: ordine.fornitori_sport && typeof ordine.fornitori_sport === 'object' && 'nome' in ordine.fornitori_sport
          ? ordine.fornitori_sport
          : null,
        tipi_ordine: ordine.tipi_ordine && typeof ordine.tipi_ordine === 'object' && 'nome' in ordine.tipi_ordine
          ? ordine.tipi_ordine
          : null
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
        const [fornitoriLentiData, fornitoriLacData, fornitoriMontaturaData, fornitoriLabEsternoData, fornitoriSportData, fornitoriAccessoriData] = await Promise.all([
          supabase.from('fornitori_lenti').select('*'),
          supabase.from('fornitori_lac').select('*'),
          supabase.from('fornitori_montature').select('*'),
          supabase.from('fornitori_lab_esterno').select('*'),
          supabase.from('fornitori_sport').select('*'),
          supabase.from('fornitori_lac').select('*') // ✅ NUOVO: Accessori usa fornitori LAC per ora
        ]);

        if (fornitoriLentiData.data) setFornitoriLenti(fornitoriLentiData.data);
        if (fornitoriLacData.data) setFornitoriLac(fornitoriLacData.data);
        if (fornitoriMontaturaData.data) setFornitoriMontature(fornitoriMontaturaData.data);
        if (fornitoriLabEsternoData.data) setFornitoriLabEsterno(fornitoriLabEsternoData.data);
        if (fornitoriSportData.data) setFornitoriSport(fornitoriSportData.data);
        if (fornitoriAccessoriData.data) setFornitoriAccessori(fornitoriAccessoriData.data); // ✅ NUOVO
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
      case 'lab.esterno': return fornitoriLabEsterno;
      case 'sport': return fornitoriSport;
      case 'accessori': return fornitoriAccessori; // ✅ NUOVO
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
      'lab.esterno': 5,
      'lenti': 5,
      'accessori': 2 // ✅ NUOVO: Accessori solitamente disponibili velocemente
    };

    return tempiDefault[categoria as keyof typeof tempiDefault] || 5;
  };

  // ===== CALCOLO DATA CONSEGNA PREVISTA =====
  const calcolaDataConsegnaPrevista = () => {
    const dataOrdine = new Date(nuovoOrdineForm.data_ordine);
    let giorniConsegna = 5;

    if (nuovoOrdineForm.giorni_consegna_custom) {
      giorniConsegna = Number.parseInt(nuovoOrdineForm.giorni_consegna_custom);
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

  // ===== CALCOLO DATA CONSEGNA PER ORDINE ESISTENTE =====
  const calcolaDataConsegnaPerOrdineEsistente = (ordine: OrdineMateriale, dataOrdinePiazzato: string) => {
    const dataOrdine = new Date(dataOrdinePiazzato);
    let giorniConsegna = ordine.giorni_consegna_medi || 5;

    // Se abbiamo giorni consegna custom dal database, usali
    if (ordine.giorni_consegna_medi) {
      giorniConsegna = ordine.giorni_consegna_medi;
    } else {
      // Altrimenti determina la categoria e usa i tempi default
      let categoria = 'lenti'; // default
      if (ordine.fornitori_lac?.nome) categoria = 'lac';
      else if (ordine.fornitori_montature?.nome) categoria = 'montature';
      else if (ordine.fornitori_sport?.nome) categoria = 'sport';
      else if (ordine.fornitori_lab_esterno?.nome) categoria = 'lab.esterno';

      giorniConsegna = getTempiConsegnaByCategoria(categoria, ordine.tipo_lenti_id || undefined);
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

  // ===== BUSINESS LOGIC: CALCOLO QUANDO ORDINE DOVREBBE ESSERE "IN ARRIVO" =====
  const calcolaDataInArrivo = (dataOrdine: string) => {
    const ordine = new Date(dataOrdine);
    const giorno = ordine.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Trova il prossimo giorno lavorativo (Lun-Ven)
    let prossimoGiornoLavorativo = new Date(ordine);

    if (giorno === 5) {
      // Venerdì → Lunedì (3 giorni dopo)
      prossimoGiornoLavorativo.setDate(ordine.getDate() + 3);
    } else if (giorno === 6) {
      // Sabato → Lunedì (2 giorni dopo)
      prossimoGiornoLavorativo.setDate(ordine.getDate() + 2);
    } else if (giorno === 0) {
      // Domenica → Lunedì (1 giorno dopo)
      prossimoGiornoLavorativo.setDate(ordine.getDate() + 1);
    } else {
      // Lun-Gio → giorno successivo
      prossimoGiornoLavorativo.setDate(ordine.getDate() + 1);
    }

    return prossimoGiornoLavorativo;
  };

  // ===== CONTROLLA SE ORDINE DOVREBBE ESSERE "IN ARRIVO" =====
  const dovrebbeEssereInArrivo = (ordine: OrdineMateriale) => {
    if (ordine.stato !== 'ordinato') return false; // Solo ordini "ordinati" possono diventare "in_arrivo"
    if (!ordine.data_ordine) return false;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0); // Reset time for accurate date-only comparison
    const dataInArrivo = calcolaDataInArrivo(ordine.data_ordine);
    dataInArrivo.setHours(0, 0, 0, 0);

    // Se oggi >= data in arrivo, allora dovrebbe essere "in_arrivo"
    return oggi >= dataInArrivo;
  };

  // ===== CONTROLLA SE ORDINE DOVREBBE ESSERE "IN RITARDO" =====
  const dovrebbeEssereInRitardo = (ordine: OrdineMateriale) => {
    // Solo ordini "in_arrivo" o "ordinato" possono diventare "in_ritardo"
    if (!['ordinato', 'in_arrivo'].includes(ordine.stato || 'ordinato')) return false;
    if (!ordine.data_consegna_prevista) return false;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const dataConsegnaPrevista = new Date(ordine.data_consegna_prevista);
    dataConsegnaPrevista.setHours(0, 0, 0, 0);

    // Se oggi > data consegna prevista, allora è in ritardo
    return oggi > dataConsegnaPrevista;
  };

  // ===== AGGIORNA AUTOMATICAMENTE GLI ORDINI CHE DOVREBBERO ESSERE "IN ARRIVO" =====
  const aggiornaOrdiniInArrivo = async () => {
    try {
      const ordiniDaAggiornare = ordiniMateriali.filter(dovrebbeEssereInArrivo);

      if (ordiniDaAggiornare.length === 0) {
        return; // Nessun ordine da aggiornare
      }

      console.log(`🚚 Aggiornamento automatico: ${ordiniDaAggiornare.length} ordini da "ordinato" a "in_arrivo"`);

      // Aggiorna tutti gli ordini che dovrebbero essere in arrivo
      const updatePromises = ordiniDaAggiornare.map(async (ordine) => {
        console.log(`📦→🚚 Auto-update: ${ordine.id} (ordinato il ${ordine.data_ordine})`);

        // Calcola la data CORRETTA quando dovrebbe essere diventato "in_arrivo"
        const dataInArrivoCorretta = calcolaDataInArrivo(ordine.data_ordine!);
        const dataInArrivoFormattata = dataInArrivoCorretta.toLocaleDateString('it-IT');

        const resp = await fetch(`/api/ordini/${ordine.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stato: 'in_arrivo',
            note: ordine.note ? `${ordine.note}\n[Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}]` : `[Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}]`
          })
        });

        if (!resp.ok) {
          const error = await resp.json();
          console.error(`❌ Errore aggiornamento ordine ${ordine.id}:`, error);
          return null;
        }

        return await resp.json();
      });

      const risultati = await Promise.all(updatePromises);
      const successi = risultati.filter(r => r !== null);

      if (successi.length > 0) {
        // Aggiorna stato locale
        setOrdiniMateriali(prev => prev.map(ordine => {
          if (ordiniDaAggiornare.find(o => o.id === ordine.id)) {
            // Calcola la data CORRETTA quando dovrebbe essere diventato "in_arrivo"
            const dataInArrivoCorretta = calcolaDataInArrivo(ordine.data_ordine!);
            const dataInArrivoFormattata = dataInArrivoCorretta.toLocaleDateString('it-IT');

            const noteAggiornate = ordine.note
              ? `${ordine.note}\n[Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}]`
              : `[Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}]`;

            return {
              ...ordine,
              stato: 'in_arrivo' as const,
              note: noteAggiornate
            };
          }
          return ordine;
        }));

        // Invalida cache
        await mutate('/api/buste');

        console.log(`✅ Aggiornati ${successi.length} ordini a "in_arrivo"`);
      }

    } catch (error) {
      console.error('❌ Errore aggiornamento automatico ordini in arrivo:', error);
    }
  };

  // ===== AGGIORNA AUTOMATICAMENTE GLI ORDINI CHE SONO "IN RITARDO" =====
  const aggiornaOrdiniInRitardo = async () => {
    try {
      const ordiniDaAggiornare = ordiniMateriali.filter(dovrebbeEssereInRitardo);

      if (ordiniDaAggiornare.length === 0) {
        return; // Nessun ordine da aggiornare
      }

      console.log(`⚠️ Aggiornamento automatico: ${ordiniDaAggiornare.length} ordini in ritardo`);

      // Aggiorna tutti gli ordini che sono in ritardo
      const updatePromises = ordiniDaAggiornare.map(async (ordine) => {
        if (!ordine.data_consegna_prevista) {
          console.warn(`⚠️ Skip aggiornamento ritardo: ordine ${ordine.id} senza data_consegna_prevista`);
          return null;
        }

        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const dataConsegnaPrevista = new Date(ordine.data_consegna_prevista);
        dataConsegnaPrevista.setHours(0, 0, 0, 0);
        const giorniRitardo = Math.floor((oggi.getTime() - dataConsegnaPrevista.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`🚨 Auto-update: ${ordine.id} in ritardo di ${giorniRitardo} giorni (previsto: ${ordine.data_consegna_prevista})`);

        const dataRitardoFormattata = oggi.toLocaleDateString('it-IT');

        const resp = await fetch(`/api/ordini/${ordine.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stato: 'in_ritardo',
            note: ordine.note
              ? `${ordine.note}\n[Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni]`
              : `[Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni]`
          })
        });

        if (!resp.ok) {
          const error = await resp.json();
          console.error(`❌ Errore aggiornamento ordine ${ordine.id}:`, error);
          return null;
        }

        return await resp.json();
      });

      const risultati = await Promise.all(updatePromises);
      const successi = risultati.filter(r => r !== null);

      if (successi.length > 0) {
        // Aggiorna stato locale
        setOrdiniMateriali(prev => prev.map(ordine => {
         if (ordiniDaAggiornare.find(o => o.id === ordine.id)) {
            if (!ordine.data_consegna_prevista) {
              return ordine;
            }
            const oggi = new Date();
            oggi.setHours(0, 0, 0, 0);
            const dataConsegnaPrevista = new Date(ordine.data_consegna_prevista);
            dataConsegnaPrevista.setHours(0, 0, 0, 0);
            const giorniRitardo = Math.floor((oggi.getTime() - dataConsegnaPrevista.getTime()) / (1000 * 60 * 60 * 24));

            const dataRitardoFormattata = oggi.toLocaleDateString('it-IT');

            const noteAggiornate = ordine.note
              ? `${ordine.note}\n[Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni]`
              : `[Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni]`;

            return {
              ...ordine,
              stato: 'in_ritardo' as const,
              note: noteAggiornate
            };
          }
          return ordine;
        }));

        // Invalida cache
        await mutate('/api/buste');

        console.log(`✅ Aggiornati ${successi.length} ordini a "in_ritardo"`);
      }

    } catch (error) {
      console.error('❌ Errore aggiornamento automatico ordini in ritardo:', error);
    }
  };

  // ===== LOAD ACCONTO INFO =====
  const loadAccontoInfo = async () => {
    try {
      const { data: infoPagamento, error } = await supabase
        .from('info_pagamenti')
        .select('importo_acconto, ha_acconto')
        .eq('busta_id', busta.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Errore caricamento acconto:', error);
        return;
      }

      if (infoPagamento) {
        setAccontoInfo(prev => ({
          ...prev,
          currentAcconto: infoPagamento.importo_acconto,
          ha_acconto: infoPagamento.ha_acconto || false,
          importo_acconto: infoPagamento.importo_acconto?.toString() || ''
        }));
      }
    } catch (error) {
      console.error('❌ Errore caricamento acconto info:', error);
    }
  };

  // ===== SAVE ACCONTO INFO - IMMEDIATO COME IL RESTO DEL SISTEMA =====
  const saveAccontoInfo = async (importoString: string) => {
    if (!canEdit) return;

    const importo = Number.parseFloat(importoString);
    if (Number.isNaN(importo) || importo < 0) {
      return; // Ignora valori non validi
    }

    try {
      console.log(`💰 Salvando acconto: €${importo} per busta ${busta.id}`);

      const { error } = await supabase
        .from('info_pagamenti')
        .upsert({
          busta_id: busta.id,
          importo_acconto: importo,
          ha_acconto: importo > 0
        }, {
          onConflict: 'busta_id'
        });

      if (error) {
        console.error('❌ Errore salvataggio acconto:', error);
        return;
      }

      setAccontoInfo(prev => ({
        ...prev,
        currentAcconto: importo,
        ha_acconto: importo > 0
      }));

      console.log('✅ Acconto salvato con successo');

      // Invalida cache per aggiornare altri componenti
      await mutate('/api/buste');

    } catch (error: any) {
      console.error('❌ Errore salvataggio acconto:', error);
    }
  };

  // ===== HANDLE ACCONTO CHANGE - SALVA IMMEDIATAMENTE =====
  const handleAccontoChange = (value: string) => {
    // Aggiorna il valore immediatamente nell'UI
    setAccontoInfo(prev => ({ ...prev, importo_acconto: value }));

    // Salva immediatamente come fa il resto del sistema
    if (value.trim() !== '') {
      saveAccontoInfo(value);
    }
  };

  // ===== HANDLE NUOVO ORDINE - ✅ AGGIORNATO CON da_ordinare =====
  // ===== ORDER VALIDATION =====
  const validateOrderForm = () => {
    if (!nuovoOrdineForm.descrizione_prodotto.trim()) {
      throw new Error('Descrizione prodotto obbligatoria');
    }
    if (!nuovoOrdineForm.categoria_prodotto) {
      throw new Error('Categoria prodotto obbligatoria');
    }
  };

  // ===== SUPPLIER MAPPING =====
  const getSupplierField = () => {
    if (!nuovoOrdineForm.fornitore_id) return null;

    const supplierMap = {
      'lenti': { fornitore_lenti_id: nuovoOrdineForm.fornitore_id },
      'lac': { fornitore_lac_id: nuovoOrdineForm.fornitore_id },
      'montature': { fornitore_montature_id: nuovoOrdineForm.fornitore_id },
      'lab.esterno': { fornitore_lab_esterno_id: nuovoOrdineForm.fornitore_id },
      'sport': { fornitore_sport_id: nuovoOrdineForm.fornitore_id },
      'accessori': { fornitore_lac_id: nuovoOrdineForm.fornitore_id } // ✅ NUOVO: Accessori usa LAC per ora
    };

    return supplierMap[nuovoOrdineForm.categoria_prodotto as keyof typeof supplierMap] || null;
  };

  // ===== DATABASE ORDER CREATION =====
  const createOrderData = () => {
    const fornitoreTableField = getSupplierField();

    // Check if tipo_ordine is "negozio"
    const tipoSelezionato = tipiOrdine.find(t => t.id === Number(nuovoOrdineForm.tipo_ordine_id));
    const isNegozio = tipoSelezionato?.nome?.toLowerCase() === 'negozio';

    // Se è "negozio", salta tutte le date e imposta come già consegnato
    if (isNegozio) {
      return {
        busta_id: busta.id,
        tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
        tipo_ordine_id: Number.parseInt(nuovoOrdineForm.tipo_ordine_id),
        descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
        data_ordine: null, // Nessuna data ordine
        data_consegna_prevista: null, // Nessuna data consegna
        giorni_consegna_medi: null,
        stato: 'consegnato' as const, // Già disponibile!
        da_ordinare: false, // Non va ordinato
        note: nuovoOrdineForm.note.trim() || null,
        ...fornitoreTableField
      };
    }

    // Ordine normale con date
    return {
      busta_id: busta.id,
      tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
      tipo_ordine_id: nuovoOrdineForm.tipo_ordine_id ? Number.parseInt(nuovoOrdineForm.tipo_ordine_id) : null,
      descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
      data_ordine: nuovoOrdineForm.data_ordine,
      data_consegna_prevista: calcolaDataConsegnaPrevista(),
      giorni_consegna_medi: nuovoOrdineForm.giorni_consegna_custom
        ? Number.parseInt(nuovoOrdineForm.giorni_consegna_custom)
        : getTempiConsegnaByCategoria(nuovoOrdineForm.categoria_prodotto, nuovoOrdineForm.tipo_lenti),
      stato: 'da_ordinare' as const,
      da_ordinare: true,
      note: nuovoOrdineForm.note.trim() || null,
      ...fornitoreTableField
    };
  };

  const insertOrderToDatabase = async (orderData: any) => {
    const { data: ordineCreato, error } = await supabase
      .from('ordini_materiali')
      .insert(orderData)
      .select(`
        *,
        fornitori_lenti:fornitori_lenti(nome),
        fornitori_lac:fornitori_lac(nome),
        fornitori_montature:fornitori_montature(nome),
        fornitori_lab_esterno:fornitori_lab_esterno(nome),
        fornitori_sport:fornitori_sport(nome),
        tipi_lenti:tipi_lenti(nome, giorni_consegna_stimati),
        tipi_ordine:tipi_ordine(nome)
      `)
      .single();

    if (error) {
      console.error('❌ Errore creazione ordine:', error);
      throw error;
    }

    return ordineCreato;
  };

  // ===== DATA TRANSFORMATION =====
  const transformOrderData = (ordineCreato: any): OrdineMateriale => {
    return {
      ...ordineCreato,
      stato: ordineCreato.stato || 'ordinato',
      da_ordinare: ordineCreato.da_ordinare ?? true,
      tipi_lenti: ordineCreato.tipi_lenti && typeof ordineCreato.tipi_lenti === 'object' && 'nome' in ordineCreato.tipi_lenti
        ? {
            ...ordineCreato.tipi_lenti,
            giorni_consegna_stimati: ordineCreato.tipi_lenti.giorni_consegna_stimati || 5
          }
        : null,
      fornitori_lab_esterno: ordineCreato.fornitori_lab_esterno && typeof ordineCreato.fornitori_lab_esterno === 'object' && 'nome' in ordineCreato.fornitori_lab_esterno
        ? ordineCreato.fornitori_lab_esterno
        : null,
      fornitori_lenti: ordineCreato.fornitori_lenti && typeof ordineCreato.fornitori_lenti === 'object' && 'nome' in ordineCreato.fornitori_lenti
        ? ordineCreato.fornitori_lenti
        : null,
      fornitori_lac: ordineCreato.fornitori_lac && typeof ordineCreato.fornitori_lac === 'object' && 'nome' in ordineCreato.fornitori_lac
        ? ordineCreato.fornitori_lac
        : null,
      fornitori_montature: ordineCreato.fornitori_montature && typeof ordineCreato.fornitori_montature === 'object' && 'nome' in ordineCreato.fornitori_montature
        ? ordineCreato.fornitori_montature
        : null,
      fornitori_sport: ordineCreato.fornitori_sport && typeof ordineCreato.fornitori_sport === 'object' && 'nome' in ordineCreato.fornitori_sport
        ? ordineCreato.fornitori_sport
        : null,
      tipi_ordine: ordineCreato.tipi_ordine && typeof ordineCreato.tipi_ordine === 'object' && 'nome' in ordineCreato.tipi_ordine
        ? ordineCreato.tipi_ordine
        : null,
    } as OrdineMateriale;
  };

  // ===== LAC MATERIAL ENTRY =====
  const createLacMaterialEntry = async () => {
    if (nuovoOrdineForm.categoria_prodotto !== 'lac') return;

    console.log('🔄 Creazione/aggiornamento entry materiali per LAC con primo_acquisto_lac:', nuovoOrdineForm.primo_acquisto_lac);

    const materialeEntry = {
      busta_id: busta.id,
      tipo: 'LAC',
      primo_acquisto_lac: nuovoOrdineForm.primo_acquisto_lac,
      note: `Collegato all'ordine: ${nuovoOrdineForm.descrizione_prodotto}`,
      stato: 'attivo'
    };

    const { data: existingEntry, error: fetchError } = await supabase
      .from('materiali')
      .select('id')
      .eq('busta_id', busta.id)
      .eq('tipo', 'LAC')
      .maybeSingle();

    if (fetchError) {
      console.error('⚠️ Errore verifica entry materiali LAC:', fetchError?.message ?? fetchError);
      return;
    }

    if (existingEntry?.id) {
      const { error: updateError } = await supabase
        .from('materiali')
        .update({
          primo_acquisto_lac: materialeEntry.primo_acquisto_lac,
          note: materialeEntry.note,
          stato: materialeEntry.stato,
        })
        .eq('id', existingEntry.id);

      if (updateError) {
        console.error('⚠️ Errore aggiornamento entry materiali LAC:', updateError?.message ?? updateError);
      } else {
        console.log('ℹ️ Entry materiali LAC già presente, aggiornata con le nuove informazioni');
      }
      return;
    }

    const { error: insertError } = await supabase
      .from('materiali')
      .insert(materialeEntry);

    if (insertError) {
      console.error('⚠️ Errore creazione entry materiali:', insertError?.message ?? insertError);
    } else {
      console.log('✅ Entry materiali LAC creata per follow-up system');
    }
  };

  // ===== FORM RESET =====
  const resetOrderForm = () => {
    setNuovoOrdineForm({
      categoria_prodotto: '',
      fornitore_id: '',
      tipo_lenti: '',
      tipo_ordine_id: '',
      descrizione_prodotto: '',
      data_ordine: new Date().toISOString().split('T')[0],
      giorni_consegna_custom: '',
      note: '',
      primo_acquisto_lac: false
    });
    setShowNuovoOrdineForm(false);
  };

  // ===== MAIN ORDER SAVE FUNCTION =====
  const handleSalvaNuovoOrdine = async () => {
    setIsSaving(true);
    try {
      validateOrderForm();

      console.log('🔄 Creazione nuovo ordine con da_ordinare:', nuovoOrdineForm);

      const orderData = createOrderData();
      console.log('🔍 Dati inserimento con da_ordinare:', orderData);

      const ordineCreato = await insertOrderToDatabase(orderData);
      console.log('✅ Ordine creato con da_ordinare:', ordineCreato);

      const ordineConTipiCorretti = transformOrderData(ordineCreato);

      // Update local state
      const ordiniAggiornati = [ordineConTipiCorretti, ...ordiniMateriali];
      setOrdiniMateriali(ordiniAggiornati);

      // Invalidate cache
      await mutate('/api/buste');

      await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'creazione ordine');

      // Create LAC material entry if needed
      await createLacMaterialEntry();

      resetOrderForm();
      console.log('✅ Ordine con da_ordinare=true salvato nel database');

    } catch (error: any) {
      console.error('❌ Error creating ordine:', error);
      alert(`Errore nella creazione: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ NUOVA FUNZIONE: Toggle da_ordinare CON RICALCOLO DELIVERY DATE
  const handleToggleDaOrdinare = async (ordineId: string, currentValue: boolean | null) => {
    try {
      const newValue = !currentValue;
      console.log(`🔄 Toggle da_ordinare per ${ordineId}: ${currentValue} → ${newValue}`);

      // Trova l'ordine per calcolare la nuova data di consegna
      const ordine = ordiniMateriali.find(o => o.id === ordineId);
      if (!ordine) {
        throw new Error('Ordine non trovato');
      }
      if ((ordine.stato || '').toLowerCase() === 'annullato') {
        alert('Questo ordine è annullato e non può essere modificato.');
        return;
      }

      const oggi = new Date().toISOString().split('T')[0];
      let updateData: any = {
        da_ordinare: newValue,
        stato: newValue ? 'da_ordinare' : 'ordinato',
      };

      // 🔥 CORREZIONE: Quando l'ordine viene piazzato (da_ordinare = false)
      if (!newValue) {
        // Imposta data ordine a oggi
        updateData.data_ordine = oggi;
        // Ricalcola data consegna prevista basata su OGGI
        updateData.data_consegna_prevista = calcolaDataConsegnaPerOrdineEsistente(ordine, oggi);
        console.log(`📅 Ricalcolo consegna: ordine piazzato ${oggi} → consegna prevista ${updateData.data_consegna_prevista}`);
      }

      // 🔥 Via API con nuovi campi
      const resp = await fetch(`/api/ordini/${ordineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Errore aggiornamento')

      console.log('✅ da_ordinare, stato e delivery date aggiornati nel database');

      // 🔥 FIX: Aggiorna stato locale con TUTTI i campi
      let ordiniAggiornati: OrdineMateriale[] = [];
      setOrdiniMateriali(prev => {
        const next = prev.map(o =>
          o.id === ordineId
            ? {
                ...o,
                ...updateData
              }
            : o
        );
        ordiniAggiornati = next;
        return next;
      });

      // ✅ SWR: Invalidate cache after order state change
      await mutate('/api/buste');
      if (ordiniAggiornati.length > 0) {
        await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'aggiornamento da_ordinare');
      }

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

      if (nuovoStato === 'annullato') {
        updateData.da_ordinare = false;
        updateData.data_ordine = null;
        updateData.data_consegna_prevista = null;
        updateData.data_consegna_effettiva = null;
      } else if (nuovoStato === 'consegnato') {
        updateData.data_consegna_effettiva = new Date().toISOString().split('T')[0];
      }

      const resp = await fetch(`/api/ordini/${ordineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Errore aggiornamento')

      console.log('✅ Stato ordine aggiornato nel database');

      // Aggiorna stato locale
      const ordiniAggiornati = ordiniMateriali.map(ordine =>
        ordine.id === ordineId
          ? { ...ordine, ...updateData }
          : ordine
      );
      setOrdiniMateriali(ordiniAggiornati);

      // ✅ SWR: Invalidate cache after order status update
      await mutate('/api/buste');
      await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'aggiornamento stato ordine');

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
      const ordiniAggiornati = ordiniMateriali.filter(ordine => ordine.id !== ordineId);
      setOrdiniMateriali(ordiniAggiornati);

      // ✅ SWR: Invalidate cache after order deletion
      await mutate('/api/buste');
      if (ordiniAggiornati.length > 0) {
        await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'eliminazione ordine');
      }

    } catch (error: any) {
      console.error('❌ Error deleting ordine:', error);
      alert(`Errore eliminazione: ${error.message}`);
    }
  };

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      
      {/* ✅ READ-ONLY BANNER - NUOVO */}
      {isReadOnly && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Modalità Sola Visualizzazione</h3>
              <p className="text-sm text-orange-700">
                Gli ordini possono essere visualizzati ma non modificati.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUOVO: SEZIONE ACCONTO (DOWN PAYMENT) */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-sm border border-yellow-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Euro className="w-6 h-6 mr-3 text-yellow-600" />
              Acconto Cliente
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Gestione del pagamento anticipato per questa busta
            </p>
          </div>

          {accontoInfo.currentAcconto !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-500">Acconto corrente</div>
              <div className="text-2xl font-bold text-green-600">
                €{accontoInfo.currentAcconto.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label htmlFor="importo-acconto" className="block text-sm font-medium text-gray-700 mb-1">
                💰 Importo Acconto
              </label>
              <div className="relative">
                <input
                  id="importo-acconto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={accontoInfo.importo_acconto}
                  onChange={(e) => handleAccontoChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="0.00"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-sm">€</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-yellow-700 bg-yellow-100 p-3 rounded-lg">
              💡 <strong>Nota:</strong> L'acconto verrà utilizzato per calcolare il saldo rimanente nel sistema pagamenti
            </div>
          </div>
        )}

        {!canEdit && accontoInfo.currentAcconto === null && (
          <div className="mt-4 text-sm text-gray-500 italic">
            Nessun acconto registrato per questa busta
          </div>
        )}
      </div>

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
          
          {/* ✅ MODIFICA: PULSANTE NUOVO ORDINE - NASCOSTO PER OPERATORI */}
          {canEdit && (
            <button
              onClick={() => setShowNuovoOrdineForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nuovo Ordine</span>
            </button>
          )}
        </div>
      </div>

      {/* ✅ MODIFICA: Form Nuovo Ordine - NASCOSTO PER OPERATORI */}
      {canEdit && showNuovoOrdineForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* ... tutto il form esistente rimane uguale ... */}
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
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  1. Categoria Prodotto *
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { value: 'lenti', label: '🔍 Lenti', desc: 'Lenti da vista/sole' },
                  { value: 'lac', label: '👁️ LAC', desc: 'Lenti a Contatto' },
                  { value: 'montature', label: '👓 Montature', desc: 'Occhiali/Sole' },
                  { value: 'lab.esterno', label: '🏭 Lab.Esterno', desc: 'Lavorazioni Esterne' },
                  { value: 'sport', label: '🏃 Sport', desc: 'Articoli Sportivi' },
                  { value: 'accessori', label: '📎 Accessori', desc: 'Custodie, cordini, etc.' } // ✅ NUOVO
                ].map(categoria => (
                  <button
                    key={categoria.value}
                    onClick={() => setNuovoOrdineForm(prev => ({
                      ...prev,
                      categoria_prodotto: categoria.value as any,
                      fornitore_id: '',
                      tipo_lenti: '',
                      primo_acquisto_lac: false // Reset when changing category
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
              </fieldset>
            </div>
      
            {/* ===== STEP 2: TIPO LENTI (Solo per categoria 'lenti') ===== */}
            {nuovoOrdineForm.categoria_prodotto === 'lenti' && (
              <div>
                <label htmlFor="tipo-lenti" className="block text-sm font-medium text-gray-700 mb-1">
                  2. Tipo Lenti *
                </label>
                <select
                  id="tipo-lenti"
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

            {/* ===== CHECKBOX PRIMO ACQUISTO LAC (Solo per categoria 'lac') ===== */}
            {nuovoOrdineForm.categoria_prodotto === 'lac' && (
              <div className="lg:col-span-3">
                <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="primo_acquisto_lac"
                    checked={nuovoOrdineForm.primo_acquisto_lac}
                    onChange={(e) => setNuovoOrdineForm(prev => ({
                      ...prev,
                      primo_acquisto_lac: e.target.checked
                    }))}
                    className="w-4 h-4 text-blue-600 bg-white border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="primo_acquisto_lac" className="text-sm font-medium text-blue-900">
                    🌟 Primo acquisto di lenti a contatto per questo cliente
                  </label>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  ✓ Seleziona se è la prima volta che questo cliente acquista LAC - influenzerà la priorità delle chiamate di follow-up
                </p>
              </div>
            )}

            {/* ===== MODALITÀ ORDINE ===== */}
            <div>
              <label htmlFor="modalita-ordine" className="block text-sm font-medium text-gray-700 mb-1">
                Modalità Ordine
              </label>
              <select
                id="modalita-ordine"
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

            {/* ===== ALERT SE "NEGOZIO" SELEZIONATO ===== */}
            {(() => {
              const tipoSelezionato = tipiOrdine.find(t => t.id === Number(nuovoOrdineForm.tipo_ordine_id));
              const isNegozio = tipoSelezionato?.nome?.toLowerCase() === 'negozio';
              return isNegozio ? (
                <div className="lg:col-span-3 bg-green-50 border border-green-200 p-3 rounded-lg">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <strong>Prodotto già disponibile in negozio</strong> - pronto per il montaggio
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    ℹ️ Non è necessario inserire date di ordine o consegna (il fornitore indica da chi è stato acquistato in origine)
                  </p>
                </div>
              ) : null;
            })()}

            {/* ===== DESCRIZIONE PRODOTTO OBBLIGATORIA ===== */}
            <div className="lg:col-span-2">
              <label htmlFor="descrizione-prodotto" className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione Prodotto * <span className="text-red-500">(Obbligatorio)</span>
              </label>
              <textarea
                id="descrizione-prodotto"
                value={nuovoOrdineForm.descrizione_prodotto}
                onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, descrizione_prodotto: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Usa parole chiave: progressive, office, monofocali, antiriflesso, polarizzazione, fotocromatico, potere..."
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                📝 <strong>Esempio:</strong> "Progressive 1.67 antiriflesso + fotocromatico | OD: +2.00 -1.25×180° ADD +2.50 | OS: +1.75 -1.00×10° ADD +2.50"
              </p>
            </div>

            {/* ===== GESTIONE DATE E TEMPI - NASCOSTE SE "NEGOZIO" ===== */}
            {(() => {
              const tipoSelezionato = tipiOrdine.find(t => t.id === Number(nuovoOrdineForm.tipo_ordine_id));
              const isNegozio = tipoSelezionato?.nome?.toLowerCase() === 'negozio';
              return !isNegozio ? (
                <>
                  <div>
                    <label htmlFor="data-ordine" className="block text-sm font-medium text-gray-700 mb-1">
                      Data Ordine
                    </label>
                    <input
                      id="data-ordine"
                      type="date"
                      value={nuovoOrdineForm.data_ordine}
                      onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, data_ordine: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="giorni-consegna-custom" className="block text-sm font-medium text-gray-700 mb-1">
                      Giorni Consegna Custom
                      <span className="text-xs text-gray-500 block">
                        (sovrascrivi automatico)
                      </span>
                    </label>
                    <input
                      id="giorni-consegna-custom"
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
                    <label htmlFor="data-consegna-prevista" className="block text-sm font-medium text-gray-700 mb-1">
                      Data Consegna Prevista
                    </label>
                    <input
                      id="data-consegna-prevista"
                      type="date"
                      value={calcolaDataConsegnaPrevista()}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Calcolata su giorni lavorativi (Lun-Sab)
                    </p>
                  </div>
                </>
              ) : null;
            })()}
      
            {/* ===== NOTE RICERCABILI ===== */}
            <div className="lg:col-span-3">
              <label htmlFor="note-aggiuntive" className="block text-sm font-medium text-gray-700 mb-1">
                Note Aggiuntive <span className="text-blue-600 text-xs">(ricercabili)</span>
              </label>
              <textarea
                id="note-aggiuntive"
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
              {canEdit ? 'Inizia creando il primo ordine per questa busta' : 'Non ci sono ordini per questa busta'}
            </p>
            {/* ✅ MODIFICA: PULSANTE SOLO SE canEdit */}
            {canEdit && (
              <button
                onClick={() => setShowNuovoOrdineForm(true)}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea Primo Ordine
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ordiniMateriali.map((ordine) => {
              const oggi = new Date();
              const statoOrdine = (ordine.stato || 'ordinato') as string;
              const isAnnullato = statoOrdine === 'annullato';
              const isArrivato = statoOrdine === 'consegnato';
              const dataConsegnaPrevista = ordine.data_consegna_prevista
                ? new Date(ordine.data_consegna_prevista)
                : null;
              const shouldShowDelayWarnings =
                !isAnnullato && !!dataConsegnaPrevista && ['ordinato', 'in_arrivo'].includes(statoOrdine);
              const giorniRitardo =
                shouldShowDelayWarnings && dataConsegnaPrevista && oggi > dataConsegnaPrevista
                  ? Math.floor((oggi.getTime() - dataConsegnaPrevista.getTime()) / (1000 * 60 * 60 * 24))
                  : 0;

              const daOrdinare = ordine.da_ordinare ?? true;

              let nomeFornitore = 'Non specificato';
              if (ordine.fornitori_lenti?.nome) nomeFornitore = ordine.fornitori_lenti.nome;
              else if (ordine.fornitori_lac?.nome) nomeFornitore = ordine.fornitori_lac.nome;
              else if (ordine.fornitori_montature?.nome) nomeFornitore = ordine.fornitori_montature.nome;
              else if (ordine.fornitori_lab_esterno?.nome) nomeFornitore = ordine.fornitori_lab_esterno.nome;
              else if (ordine.fornitori_sport?.nome) nomeFornitore = ordine.fornitori_sport.nome;

              const cardBaseClasses = isAnnullato
                ? 'bg-slate-100/70 border border-slate-200 cursor-not-allowed'
                : 'hover:bg-gray-50';
              const titoloOrdineClass = isAnnullato
                ? 'text-lg font-medium text-gray-500'
                : 'text-lg font-medium text-gray-900';
              const infoRowTextClass = isAnnullato ? 'text-gray-400' : 'text-gray-600';

              return (
                <div key={ordine.id} className={`p-6 transition-colors ${cardBaseClasses}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className={titoloOrdineClass}>
                          {ordine.descrizione_prodotto}
                        </h4>
                        
                        {/* ✅ MODIFICA: Toggle da_ordinare - NASCOSTO PER OPERATORI */}
                        {canEdit && !isAnnullato && (
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
                        )}
                        
                        {/* ✅ Per operatori, mostra solo lo stato senza possibilità di cambiarlo */}
                        {!canEdit && !isAnnullato && (
                          <span className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                            daOrdinare 
                              ? 'bg-orange-100 text-orange-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
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
                          </span>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          {/* Mostra icone di warning anche per ordini "in_arrivo" se sono in ritardo */}
                          {!isAnnullato && ['ordinato', 'in_arrivo'].includes(statoOrdine) && giorniRitardo > 0 && giorniRitardo <= 2 && (
                            <span className="text-yellow-500 text-xl ml-2" title={`${giorniRitardo} giorno${giorniRitardo > 1 ? 'i' : ''} di ritardo`}>
                              ⚠️
                            </span>
                          )}
                          {!isAnnullato && ['ordinato', 'in_arrivo'].includes(statoOrdine) && giorniRitardo > 2 && (
                            <span className="text-red-600 text-xl ml-2" title={`${giorniRitardo} giorni di ritardo grave`}>
                              🚨
                            </span>
                          )}
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statoOrdine === 'consegnato' ? 'bg-green-100 text-green-800' :
                            statoOrdine === 'in_arrivo' ? 'bg-cyan-100 text-cyan-800' :
                            statoOrdine === 'in_ritardo' ? 'bg-red-100 text-red-800' :
                            statoOrdine === 'ordinato' ? 'bg-blue-100 text-blue-800' :
                            statoOrdine === 'da_ordinare' ? 'bg-purple-100 text-purple-800' :
                            statoOrdine === 'rifiutato' ? 'bg-gray-100 text-gray-800' :
                            statoOrdine === 'annullato' ? 'bg-slate-100 text-slate-600' :
                            'bg-orange-100 text-orange-800'
                            }`}>
                            {statoOrdine.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        </div>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm ${infoRowTextClass}`}>
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
                        {ordine.data_ordine && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>
                              <strong>Ordinato:</strong> {new Date(ordine.data_ordine).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}
                        
                        {ordine.data_consegna_prevista && (
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>
                              <strong>Previsto:</strong> {new Date(ordine.data_consegna_prevista).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}

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
                        <div className={`mt-3 p-3 rounded-md ${isAnnullato ? 'bg-slate-100 border border-slate-200' : 'bg-gray-50'}`}>
                          <p className={`text-sm ${isAnnullato ? 'text-gray-500' : 'text-gray-700'}`}>
                            <strong>Note:</strong> {ordine.note}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ✅ MODIFICA: AZIONI - NASCOSTE PER OPERATORI */}
                    {canEdit && (
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <select
                          value={statoOrdine}
                          onChange={(e) => handleAggiornaStatoOrdine(ordine.id, e.target.value)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 focus:border-blue-500"
                          title="Solo stati manuali disponibili. Stati automatici gestiti dal sistema"
                        >
                          {/* Mostra lo stato corrente se automatico (disabled placeholder) */}
                          {['da_ordinare', 'ordinato', 'in_arrivo', 'in_ritardo'].includes(statoOrdine) && (
                            <option value={statoOrdine} disabled>
                              {statoOrdine === 'da_ordinare' && '🛒 Da Ordinare (auto)'}
                              {statoOrdine === 'ordinato' && '📦 Ordinato (auto)'}
                              {statoOrdine === 'in_arrivo' && '🚚 In Arrivo (auto)'}
                              {statoOrdine === 'in_ritardo' && '⏰ In Ritardo (auto)'}
                            </option>
                          )}
                          {/* Stati manuali selezionabili */}
                          <option value="consegnato">✅ Consegnato</option>
                          <option value="accettato_con_riserva">🔄 Con Riserva</option>
                          <option value="rifiutato">❌ Rifiutato</option>
                          <option value="annullato">🚫 Annullato</option>
                        </select>
                  
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteOrdine(ordine.id)}
                            className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors border border-red-200"
                            title="Elimina ordine"
                          >
                            <span className="hidden md:block">Elimina</span>
                            <Trash2 className="w-4 h-4 md:hidden" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Riepilogo - SEMPRE VISIBILE */}
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
