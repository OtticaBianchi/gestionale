// ===== FILE: buste/[id]/_components/tabs/MaterialiTab.tsx =====
// 🔥 VERSIONE AGGIORNATA - CON CAMPO da_ordinare + READ-ONLY MODE

'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
import {
  ShoppingCart,
  Plus,
  Truck,
  Factory,
  Eye,
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
  Save,
  Edit3,
  FileText,
  MoreVertical
} from 'lucide-react';
import type { WorkflowState } from '@/app/dashboard/_components/WorkflowLogic';
import { areAllOrdersCancelled } from '@/lib/buste/archiveRules';
import { useUser } from '@/context/UserContext';
import { LENS_TREATMENTS, LENS_TREATMENTS_OPTIONS, getTreatmentLabel } from '@/lib/constants/lens-types';

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
  da_ordinare?: boolean | null;
  stato_disponibilita?: 'disponibile' | 'riassortimento' | 'esaurito';
  promemoria_disponibilita?: string | null;
  needs_action?: boolean | null;
  needs_action_type?: string | null;
  needs_action_done?: boolean | null;
  needs_action_due_date?: string | null;
  cancel_reason?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  fornitori_lenti?: { nome: string } | null;
  fornitori_lac?: { nome: string } | null;
  fornitori_montature?: { nome: string } | null;
  fornitori_lab_esterno?: { nome: string } | null;
  fornitori_sport?: { nome: string } | null;
  tipi_lenti?: { nome: string; giorni_consegna_stimati: number | null } | null;
  classificazione_lenti?: { nome: string } | null;
  tipi_ordine?: { nome: string } | null;
  prezzo_prodotto?: number | null;
  trattamenti?: string[] | null;
};

type Fornitore = {
  id: string;
  nome: string;
};

type TipoOrdine = Database['public']['Tables']['tipi_ordine']['Row'];
type TipoLenti = Database['public']['Tables']['tipi_lenti']['Row'];
type ClassificazioneLenti = Database['public']['Tables']['classificazione_lenti']['Row'];
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

const DISPONIBILITA_STATES = ['disponibile', 'riassortimento', 'esaurito'] as const;
const DISPONIBILITA_PRIORITY: Record<typeof DISPONIBILITA_STATES[number], number> = {
  disponibile: 0,
  riassortimento: 1,
  esaurito: 2
};

const DISPONIBILITA_BADGE: Record<typeof DISPONIBILITA_STATES[number], { label: string; className: string }> = {
  disponibile: {
    label: 'Disponibile',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  },
  riassortimento: {
    label: 'In riassortimento',
    className: 'bg-amber-100 text-amber-700 border border-amber-200'
  },
  esaurito: {
    label: 'Esaurito',
    className: 'bg-red-100 text-red-700 border border-red-200'
  }
};

type NeedsActionType = 'CALL_CLIENT' | 'CONTACT_SUPPLIER' | 'MID_PROCESS' | 'OTHER';
type ActionRequiredValue = 'none' | NeedsActionType;
type EventType =
  | 'ritardo_slittamento'
  | 'riassortimento'
  | 'esaurito'
  | 'variazione_prodotto'
  | 'serve_cliente'
  | 'prodotto_errato'
  | 'altro';

type NuovoOrdineForm = {
  categoria_prodotto: '' | 'lenti' | 'lac' | 'montature' | 'sport' | 'accessori' | 'lab.esterno' | 'assistenza' | 'ricambi';
  tipo_prodotto_assistenza: '' | 'lenti' | 'lac' | 'montature' | 'sport' | 'accessori';
  tipo_prodotto_ricambi: '' | 'montature' | 'sport' | 'accessori' | 'lenti';
  fornitore_id: string;
  tipo_lenti: string;  // Stock/RX/Special from tipi_lenti table
  classificazione_lenti: string;  // Monofocali/Progressive/etc. from classificazione_lenti table
  trattamenti: string[];
  tipo_ordine_id: string;
  descrizione_prodotto: string;
  data_ordine: string;
  giorni_consegna_custom: string;
  note: string;
  primo_acquisto_lac: boolean;
  ordine_gia_effettuato: boolean;
  data_consegna_effettiva: string;
};

const ACTION_REQUIRED_OPTIONS: Array<{ value: ActionRequiredValue; label: string }> = [
  { value: 'none', label: 'Nessuna' },
  { value: 'CALL_CLIENT', label: 'Contattare cliente' },
  { value: 'CONTACT_SUPPLIER', label: 'Sollecitare fornitore' },
  { value: 'MID_PROCESS', label: 'Cliente necessario a metà lavorazione' },
  { value: 'OTHER', label: 'Altro' }
];

const ACTION_CHIP_LABELS: Record<NeedsActionType, string> = {
  CALL_CLIENT: '📞 Cliente da contattare',
  CONTACT_SUPPLIER: '🏭 Sollecito fornitore',
  MID_PROCESS: '👤 Cliente necessario (metà lavorazione)',
  OTHER: '⚠️ Azione richiesta'
};

const ACTION_COMPLETION_LABELS: Record<NeedsActionType, string> = {
  CALL_CLIENT: 'Cliente contattato',
  CONTACT_SUPPLIER: 'Sollecito fornitore',
  MID_PROCESS: 'Cliente a metà lavorazione',
  OTHER: 'Azione generica'
};

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: 'ritardo_slittamento', label: 'Ritardo / slittamento consegna' },
  { value: 'riassortimento', label: 'In riassortimento' },
  { value: 'esaurito', label: 'Esaurito' },
  { value: 'variazione_prodotto', label: 'Variazione prodotto / tempi' },
  { value: 'serve_cliente', label: 'Serve cliente a metà lavorazione' },
  { value: 'prodotto_errato', label: 'Prodotto non corrisponde / ordine errato' },
  { value: 'altro', label: 'Altro' }
];

const EVENT_LABELS: Record<EventType, string> = EVENT_TYPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<EventType, string>);

const formatDateForInput = (value: string | null | undefined) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const toIsoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseDateSafe = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTimestamp = (value: Date = new Date()) => {
  const pad = (input: number) => String(input).padStart(2, '0');
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatDateInputValue = (value: Date) => {
  const pad = (input: number) => String(input).padStart(2, '0');
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};

const getTomorrowDateInput = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateInputValue(tomorrow);
};

const normalizeNoteMessage = (value: string) =>
  value.replace(/\s+/g, ' ').trim();

const buildNoteLine = (message: string, author: string) =>
  `${formatTimestamp()} - ${author}: ${message}`;

const appendNoteLine = (existing: string | null | undefined, line: string) =>
  existing ? `${existing}\n${line}` : line;

const resolveWorkflowState = (state: string): WorkflowState =>
  (WORKFLOW_STATES.includes(state as WorkflowState) ? (state as WorkflowState) : 'nuove');

// Props del componente
interface MaterialiTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean; // ✅ AGGIUNTO
  canDelete?: boolean; // ✅ Solo admin possono cancellare ordini
}                                                                                                            

export default function MaterialiTab({ busta, isReadOnly = false, canDelete = false }: MaterialiTabProps) {
  const getDefaultOrderDate = () =>
    formatDateForInput(busta.data_apertura) || new Date().toISOString().split('T')[0];

  const { user, profile } = useUser();
  const canEditOrder = !isReadOnly && profile?.role === 'admin';
  const currentUserLabel = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    if (user?.email) return user.email.split('@')[0] || 'Utente';
    return 'Utente';
  }, [profile?.full_name, user?.email]);

  // ===== STATE =====
  const [ordiniMateriali, setOrdiniMateriali] = useState<OrdineMateriale[]>([]);
  const [tipiOrdine, setTipiOrdine] = useState<TipoOrdine[]>([]);
  const [tipiLenti, setTipiLenti] = useState<TipoLenti[]>([]);
  const [classificazioneLenti, setClassificazioneLenti] = useState<ClassificazioneLenti[]>([]);
  
  // Fornitori specializzati per categoria
  const [fornitoriLenti, setFornitoriLenti] = useState<Fornitore[]>([]);
  const [fornitoriLac, setFornitoriLac] = useState<Fornitore[]>([]);
  const [fornitoriMontature, setFornitoriMontature] = useState<Fornitore[]>([]);
  const [fornitoriLabEsterno, setFornitoriLabEsterno] = useState<Fornitore[]>([]);
  const [fornitoriSport, setFornitoriSport] = useState<Fornitore[]>([]);
  const [fornitoriAccessori, setFornitoriAccessori] = useState<Fornitore[]>([]); // ✅ Accessori e Liquidi
  const [fornitoriAssistenza, setFornitoriAssistenza] = useState<Fornitore[]>([]); // ✅ NUOVO: Assistenza (combined list)
  const [fornitoriRicambi, setFornitoriRicambi] = useState<Fornitore[]>([]); // ✅ NUOVO: Ricambi (filtered list)
  
  const [showNuovoOrdineForm, setShowNuovoOrdineForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isLoadingOrdini, setIsLoadingOrdini] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowState>(resolveWorkflowState(busta.stato_attuale));

  // ✅ NUOVO: State per acconto (down payment) della busta
  const [accontoInfo, setAccontoInfo] = useState({
    importo_acconto: '',
    ha_acconto: false,
    currentAcconto: null as number | null
  });

  // ✅ NUOVO: State per editing descrizione prodotto
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [eventOrderId, setEventOrderId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    type: '' as EventType | '',
    description: '',
    actionRequired: 'none' as ActionRequiredValue,
    dueDate: '',
    actionDoneNow: false,
    // ✅ Campo colpa per prodotto_errato
    colpaErrore: '' as '' | 'errore_interno' | 'errore_cliente' | 'errore_fornitore'
  });
  const [eventErrors, setEventErrors] = useState<{ type?: string; description?: string; colpa?: string }>({});
  const [availabilityPrompt, setAvailabilityPrompt] = useState<{ ordineId: string; stato: 'riassortimento' | 'esaurito' } | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  const [showSospesaFollowupModal, setShowSospesaFollowupModal] = useState(false);
  const [sospesaFollowupReason, setSospesaFollowupReason] = useState('');
  const [sospesaFollowupNote, setSospesaFollowupNote] = useState('');
  const [isSavingSospesaFollowup, setIsSavingSospesaFollowup] = useState(false);
  const [sospesaFollowupDoneAt, setSospesaFollowupDoneAt] = useState<string | null>(
    busta.sospesa_followup_done_at ?? null
  );
  const [noteGenerali, setNoteGenerali] = useState<string | null>(busta.note_generali ?? null);

  const disponibilitaStats = useMemo<{
    counts: Record<typeof DISPONIBILITA_STATES[number], number>;
    worstStatus: typeof DISPONIBILITA_STATES[number];
    nextReminder: Date | null;
  }>(() => {
    const counts: Record<typeof DISPONIBILITA_STATES[number], number> = {
      disponibile: 0,
      riassortimento: 0,
      esaurito: 0
    };
    let worstStatus: typeof DISPONIBILITA_STATES[number] = 'disponibile';
    let nextReminder: Date | null = null;

    let hasAvailabilityData = false;

    ordiniMateriali.forEach((ordine) => {
      const statoOrdine = (ordine.stato || '').toLowerCase();
      if (statoOrdine === 'annullato') {
        return;
      }

      const stato = (ordine.stato_disponibilita || 'disponibile') as typeof DISPONIBILITA_STATES[number];
      counts[stato] = (counts[stato] ?? 0) + 1;
      hasAvailabilityData = true;

      if (DISPONIBILITA_PRIORITY[stato] > DISPONIBILITA_PRIORITY[worstStatus]) {
        worstStatus = stato;
      }

      const promemoria = parseDateSafe(ordine.promemoria_disponibilita);
      if (promemoria && (!nextReminder || promemoria < nextReminder)) {
        nextReminder = promemoria;
      }
    });

    if (!hasAvailabilityData) {
      return { counts, worstStatus: 'disponibile', nextReminder: null };
    }

    return { counts, worstStatus, nextReminder };
  }, [ordiniMateriali]);

  const promemoriaDisponibilitaScaduto = disponibilitaStats.nextReminder
    ? disponibilitaStats.nextReminder.getTime() <= Date.now()
    : false;
  const disponibilitaReminderLabel = disponibilitaStats.nextReminder
    ? disponibilitaStats.nextReminder.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const disponibilitaTotali =
    disponibilitaStats.counts.disponibile +
    disponibilitaStats.counts.riassortimento +
    disponibilitaStats.counts.esaurito;
  const showDisponibilitaBadge = disponibilitaTotali > 0 && disponibilitaStats.worstStatus !== 'disponibile';

  // ✅ Calcola se annullare l'ordine corrente causerà archiviazione
  const cancelWillArchive = useMemo(() => {
    if (!cancelOrderId) return false;

    // Conta ordini NON annullati (escludendo quello che stiamo per annullare)
    const activeOrdersExcludingCurrent = ordiniMateriali.filter(o =>
      o.id !== cancelOrderId && (o.stato || '').toLowerCase() !== 'annullato'
    );

    // Se dopo l'annullamento non ci sono più ordini attivi → archiviazione
    return activeOrdersExcludingCurrent.length === 0;
  }, [cancelOrderId, ordiniMateriali]);

  // ✅ AGGIUNTO: Helper per controlli
  const canEdit = !isReadOnly;

  // Nuovo ordine form con categorie
  const [nuovoOrdineForm, setNuovoOrdineForm] = useState<NuovoOrdineForm>({
    categoria_prodotto: '', // ✅ AGGIUNTO: accessori, assistenza, ricambi
    tipo_prodotto_assistenza: '', // ✅ NUOVO: Sottocategoria per Assistenza
    tipo_prodotto_ricambi: '', // ✅ NUOVO: Sottocategoria per Ricambi
    fornitore_id: '',
    tipo_lenti: '',
    classificazione_lenti: '',
    trattamenti: [],
    tipo_ordine_id: '',
    descrizione_prodotto: '',
    data_ordine: new Date().toISOString().split('T')[0],
    giorni_consegna_custom: '',
    note: '',
    primo_acquisto_lac: false,
    ordine_gia_effettuato: false,
    data_consegna_effettiva: ''
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  type UpdateOrdineDescriptionResponse = {
    success?: boolean;
    ordine?: {
      id: string;
      descrizione_prodotto: string;
      updated_by?: string | null;
      updated_at?: string | null;
    };
    message?: string;
    error?: string;
  };

  type DeleteOrdineResponse = {
    success?: boolean;
    error?: string;
  };

  type CreateOrdineResponse = {
    success?: boolean;
    ordine?: any;
    error?: string;
  };

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
      if (busta.archived_mode !== 'ANNULLATA') {
        try {
          await appendBustaNote(
            'Tutti gli ordini annullati → busta archiviata automaticamente (ANNULLATA).',
            'Sistema',
            { archived_mode: 'ANNULLATA' }
          );
        } catch (error: any) {
          console.error('❌ Errore archiviazione automatica busta:', error);
        }
      }
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

  const notifyNotesUpdated = () => {
    window.dispatchEvent(new CustomEvent('busta:notes:update', { detail: { bustaId: busta.id } }));
  };

  const patchOrdine = async (ordineId: string, updates: Record<string, any>) => {
    const response = await fetch(`/api/ordini/${ordineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Errore aggiornamento ordine');
    }

    return payload?.ordine || updates;
  };

  const patchBusta = async (updates: Record<string, any>) => {
    const response = await fetch(`/api/buste/${busta.id}/anagrafica`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Errore aggiornamento busta');
    }

    return payload?.busta || updates;
  };

  const appendBustaNote = async (message: string, author: string, extraUpdates: Record<string, any> = {}) => {
    const noteLine = buildNoteLine(message, author);
    const nextNotes = appendNoteLine(noteGenerali, noteLine);
    await patchBusta({
      note_generali: nextNotes,
      ...extraUpdates
    });
    setNoteGenerali(nextNotes);
    notifyNotesUpdated();
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

  useEffect(() => {
    setSospesaFollowupDoneAt(busta.sospesa_followup_done_at ?? null);
    setNoteGenerali(busta.note_generali ?? null);
  }, [busta.id, busta.sospesa_followup_done_at, busta.note_generali]);

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
          classificazione_lenti:classificazione_lenti(nome),
          tipi_ordine:tipi_ordine(nome)
        `)
        .eq('busta_id', busta.id)
        .is('deleted_at', null) // ✅ FIX: Exclude soft-deleted orders
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
        stato_disponibilita: ordine.stato_disponibilita || 'disponibile',
        promemoria_disponibilita: ordine.promemoria_disponibilita || null,
        needs_action: ordine.needs_action ?? false,
        needs_action_done: ordine.needs_action_done ?? false,
        needs_action_type: ordine.needs_action_type || null,
        needs_action_due_date: ordine.needs_action_due_date || null,
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
        classificazione_lenti: ordine.classificazione_lenti && typeof ordine.classificazione_lenti === 'object' && 'nome' in ordine.classificazione_lenti
          ? ordine.classificazione_lenti
          : null,
        tipi_ordine: ordine.tipi_ordine && typeof ordine.tipi_ordine === 'object' && 'nome' in ordine.tipi_ordine
          ? ordine.tipi_ordine
          : null
      })) as OrdineMateriale[];

      setOrdiniMateriali(ordiniTipizzati);

      // Load reference data se non già caricati
      if (tipiOrdine.length === 0) {
        const [tipiOrdineData, tipiLentiData, classificazioneLentiData] = await Promise.all([
          supabase.from('tipi_ordine').select('*'),
          supabase.from('tipi_lenti').select('*'),  // Stock/RX/Special
          supabase.from('classificazione_lenti').select('*')  // Monofocali/Progressive/Office/etc.
        ]);

        if (tipiOrdineData.data) setTipiOrdine(tipiOrdineData.data);
        if (tipiLentiData.data) setTipiLenti(tipiLentiData.data);
        if (classificazioneLentiData.data) setClassificazioneLenti(classificazioneLentiData.data);

        // ===== CARICA FORNITORI DALLE TABELLE SPECIALIZZATE =====
        const [fornitoriLentiData, fornitoriLacData, fornitoriMontaturaData, fornitoriLabEsternoData, fornitoriSportData, fornitoriAccessoriData] = await Promise.all([
          supabase.from('fornitori_lenti').select('*'),
          supabase.from('fornitori_lac').select('*'),
          supabase.from('fornitori_montature').select('*'),
          supabase.from('fornitori_lab_esterno').select('*'),
          supabase.from('fornitori_sport').select('*'),
          supabase.from('fornitori_accessori').select('*') // ✅ Dedicated accessori suppliers table
        ]);

        if (fornitoriLentiData.data) setFornitoriLenti(fornitoriLentiData.data);
        if (fornitoriLacData.data) setFornitoriLac(fornitoriLacData.data);
        if (fornitoriMontaturaData.data) setFornitoriMontature(fornitoriMontaturaData.data);
        if (fornitoriLabEsternoData.data) setFornitoriLabEsterno(fornitoriLabEsternoData.data);
        if (fornitoriSportData.data) setFornitoriSport(fornitoriSportData.data);
        if (fornitoriAccessoriData.data) setFornitoriAccessori(fornitoriAccessoriData.data); // ✅ Accessori e Liquidi

        // ✅ Assistenza = combined list of all suppliers
        const combinedAssistenza = [
          ...(fornitoriLentiData.data || []),
          ...(fornitoriLacData.data || []),
          ...(fornitoriMontaturaData.data || []),
          ...(fornitoriLabEsternoData.data || []),
          ...(fornitoriSportData.data || [])
        ];
        setFornitoriAssistenza(combinedAssistenza);

        // ✅ Ricambi = only Montature, Sport, Accessori suppliers
        const combinedRicambi = [
          ...(fornitoriMontaturaData.data || []),
          ...(fornitoriSportData.data || []),
          ...(fornitoriAccessoriData.data || [])
        ];
        setFornitoriRicambi(combinedRicambi);
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
    // ✅ NUOVO: Assistenza - filter by tipo_prodotto_assistenza
    if (nuovoOrdineForm.categoria_prodotto === 'assistenza') {
      switch (nuovoOrdineForm.tipo_prodotto_assistenza) {
        case 'lenti': return fornitoriLenti;
        case 'lac': return fornitoriLac;
        case 'montature': return fornitoriMontature;
        case 'sport': return fornitoriSport;
        case 'accessori': return fornitoriAccessori;
        default: return []; // No suppliers until tipo_prodotto_assistenza is selected
      }
    }

    // ✅ NUOVO: Ricambi - filter by tipo_prodotto_ricambi
    if (nuovoOrdineForm.categoria_prodotto === 'ricambi') {
      switch (nuovoOrdineForm.tipo_prodotto_ricambi) {
        case 'montature': return fornitoriMontature;
        case 'lenti': return fornitoriMontature; // Same suppliers as Montature
        case 'sport': return fornitoriSport;
        case 'accessori': return fornitoriAccessori;
        default: return []; // No suppliers until tipo_prodotto_ricambi is selected
      }
    }

    // Regular categories
    switch (nuovoOrdineForm.categoria_prodotto) {
      case 'lenti': return fornitoriLenti;
      case 'lac': return fornitoriLac;
      case 'montature': return fornitoriMontature;
      case 'lab.esterno': return fornitoriLabEsterno;
      case 'sport': return fornitoriSport;
      case 'accessori': return fornitoriAccessori;
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
      'accessori': 2,
      'assistenza': 3,
      'ricambi': 3
    };

    return tempiDefault[categoria as keyof typeof tempiDefault] || 5;
  };

  // ===== CALCOLO DATA CONSEGNA PREVISTA =====
  const calcolaDataConsegnaPrevista = () => {
    if (!nuovoOrdineForm.data_ordine) return '';
    const dataOrdine = new Date(nuovoOrdineForm.data_ordine);
    if (Number.isNaN(dataOrdine.getTime())) return '';
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

        const line = buildNoteLine(`Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}.`, 'Sistema');
        const updatedNote = appendNoteLine(ordine.note, line);

        const resp = await fetch(`/api/ordini/${ordine.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stato: 'in_arrivo',
            note: updatedNote
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

            const line = buildNoteLine(`Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}.`, 'Sistema');
            const noteAggiornate = appendNoteLine(ordine.note, line);

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
        notifyNotesUpdated();

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

        const line = buildNoteLine(
          `Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni.`,
          'Sistema'
        );
        const updatedNote = appendNoteLine(ordine.note, line);

        const resp = await fetch(`/api/ordini/${ordine.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stato: 'in_ritardo',
            note: updatedNote
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

            const line = buildNoteLine(
              `Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni.`,
              'Sistema'
            );
            const noteAggiornate = appendNoteLine(ordine.note, line);

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
        notifyNotesUpdated();

        console.log(`✅ Aggiornati ${successi.length} ordini a "in_ritardo"`);
      }

    } catch (error) {
      console.error('❌ Errore aggiornamento automatico ordini in ritardo:', error);
    }
  };

  // ===== LOAD ACCONTO INFO =====
  type AccontoResponse = {
    success?: boolean;
    acconto?: { importo_acconto: number | null; ha_acconto: boolean | null } | null;
    error?: string;
    details?: string;
  };

  const loadAccontoInfo = async () => {
    try {
      const response = await fetch(`/api/buste/${busta.id}/acconto`);
      const result: AccontoResponse = await response
        .json()
        .catch(() => ({} as AccontoResponse));

      if (!response.ok) {
        console.error('❌ Errore caricamento acconto:', result?.error);
        return;
      }

      if (result.acconto) {
        setAccontoInfo(prev => ({
          ...prev,
          currentAcconto: result.acconto?.importo_acconto ?? null,
          ha_acconto: result.acconto?.ha_acconto ?? false,
          importo_acconto: result.acconto?.importo_acconto?.toString() || ''
        }));
      }
    } catch (error) {
      console.error('❌ Errore caricamento acconto info:', error);
    }
  };

  // ===== SAVE ACCONTO INFO - IMMEDIATO COME IL RESTO DEL SISTEMA =====
  const saveAccontoInfo = async (importoString: string) => {
    if (!canEdit) return;

    const cleaned = importoString.trim();
    const importo = cleaned === '' ? 0 : Number.parseFloat(cleaned);
    if (Number.isNaN(importo) || importo < 0) {
      return; // Ignora valori non validi
    }

    try {
      console.log(`💰 Salvando acconto: €${importo} per busta ${busta.id}`);

      const response = await fetch(`/api/buste/${busta.id}/acconto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importo_acconto: importo })
      });

      const result: AccontoResponse = await response
        .json()
        .catch(() => ({} as AccontoResponse));

      if (!response.ok || !result?.success) {
        const details = result?.details ? ` (${result.details})` : '';
        console.error(`❌ Errore salvataggio acconto: ${result?.error || 'Errore'}${details}`);
        return;
      }

      setAccontoInfo(prev => ({
        ...prev,
        currentAcconto: importo > 0 ? importo : null,
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
    saveAccontoInfo(value);
  };

  // ===== HANDLE NUOVO ORDINE - ✅ AGGIORNATO CON da_ordinare =====
  // ===== ORDER VALIDATION =====
  const getOrderFormValidationError = () => {
    if (!nuovoOrdineForm.categoria_prodotto) {
      return 'Categoria prodotto obbligatoria';
    }
    if (nuovoOrdineForm.categoria_prodotto === 'assistenza' && !nuovoOrdineForm.tipo_prodotto_assistenza) {
      return 'Seleziona il tipo prodotto per assistenza';
    }
    if (nuovoOrdineForm.categoria_prodotto === 'ricambi' && !nuovoOrdineForm.tipo_prodotto_ricambi) {
      return 'Seleziona il tipo prodotto per ricambi';
    }
    if (nuovoOrdineForm.categoria_prodotto === 'lenti') {
      if (!nuovoOrdineForm.tipo_lenti) {
        return 'Tipo lenti obbligatorio';
      }
      if (!nuovoOrdineForm.classificazione_lenti) {
        return 'Classificazione lenti obbligatoria';
      }
      if (!nuovoOrdineForm.trattamenti || nuovoOrdineForm.trattamenti.length === 0) {
        return 'Seleziona almeno un trattamento (o "Nessuno")';
      }
    }
    if (!nuovoOrdineForm.fornitore_id) {
      return 'Fornitore obbligatorio';
    }
    if (!nuovoOrdineForm.tipo_ordine_id) {
      return 'Modalità ordine obbligatoria';
    }
    if (!nuovoOrdineForm.descrizione_prodotto.trim()) {
      return 'Descrizione prodotto obbligatoria';
    }
    if (nuovoOrdineForm.ordine_gia_effettuato && !nuovoOrdineForm.data_ordine) {
      return 'Inserisci la data ordine per gli ordini già effettuati';
    }
    return null;
  };

  const validateOrderForm = () => {
    const error = getOrderFormValidationError();
    if (error) {
      throw new Error(error);
    }
  };

  // ===== SUPPLIER MAPPING =====
  const getSupplierField = () => {
    if (!nuovoOrdineForm.fornitore_id) return null;

    // ✅ NUOVO: Assistenza - use tipo_prodotto_assistenza to determine supplier table
    if (nuovoOrdineForm.categoria_prodotto === 'assistenza') {
      const supplierId = nuovoOrdineForm.fornitore_id;
      const tipoAssistenza = nuovoOrdineForm.tipo_prodotto_assistenza;

      const assistenzaSupplierMap = {
        'lenti': { fornitore_lenti_id: supplierId },
        'lac': { fornitore_lac_id: supplierId },
        'montature': { fornitore_montature_id: supplierId },
        'sport': { fornitore_sport_id: supplierId },
        'accessori': { fornitore_accessori_id: supplierId } // Accessori uses dedicated table
      };

      return assistenzaSupplierMap[tipoAssistenza as keyof typeof assistenzaSupplierMap] || null;
    }

    // ✅ NUOVO: Ricambi - use tipo_prodotto_ricambi to determine supplier table
    if (nuovoOrdineForm.categoria_prodotto === 'ricambi') {
      const supplierId = nuovoOrdineForm.fornitore_id;
      const tipoRicambi = nuovoOrdineForm.tipo_prodotto_ricambi;

      const ricambiSupplierMap = {
        'montature': { fornitore_montature_id: supplierId },
        'lenti': { fornitore_montature_id: supplierId }, // Same as Montature
        'sport': { fornitore_sport_id: supplierId },
        'accessori': { fornitore_accessori_id: supplierId } // Accessori uses dedicated table
      };

      return ricambiSupplierMap[tipoRicambi as keyof typeof ricambiSupplierMap] || null;
    }

    const supplierMap = {
      'lenti': { fornitore_lenti_id: nuovoOrdineForm.fornitore_id },
      'lac': { fornitore_lac_id: nuovoOrdineForm.fornitore_id },
      'montature': { fornitore_montature_id: nuovoOrdineForm.fornitore_id },
      'lab.esterno': { fornitore_lab_esterno_id: nuovoOrdineForm.fornitore_id },
      'sport': { fornitore_sport_id: nuovoOrdineForm.fornitore_id },
      'accessori': { fornitore_accessori_id: nuovoOrdineForm.fornitore_id } // ✅ Accessori e Liquidi dedicated table
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
    const rawNote = normalizeNoteMessage(nuovoOrdineForm.note);
    const formattedNote = rawNote ? buildNoteLine(rawNote, currentUserLabel) : null;

    if (isNegozio) {
      return {
        busta_id: busta.id,
        tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
        classificazione_lenti_id: nuovoOrdineForm.classificazione_lenti || null,
        trattamenti: nuovoOrdineForm.trattamenti.length > 0 ? nuovoOrdineForm.trattamenti : null,
        tipo_ordine_id: Number.parseInt(nuovoOrdineForm.tipo_ordine_id),
        descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
        data_ordine: null, // Nessuna data ordine
        data_consegna_prevista: null, // Nessuna data consegna
        giorni_consegna_medi: null,
        stato: 'consegnato' as const, // Già disponibile!
        da_ordinare: false, // Non va ordinato
        note: formattedNote,
        ...fornitoreTableField
      };
    }

    const ordineGiaEffettuato = nuovoOrdineForm.ordine_gia_effettuato;
    const dataConsegnaEffettiva = ordineGiaEffettuato
      ? (nuovoOrdineForm.data_consegna_effettiva || null)
      : null;
    const statoIniziale = dataConsegnaEffettiva
      ? 'consegnato'
      : (ordineGiaEffettuato ? 'ordinato' : 'da_ordinare');
    const daOrdinare = dataConsegnaEffettiva ? false : !ordineGiaEffettuato;
    const dataConsegnaPrevista = ordineGiaEffettuato
      ? (calcolaDataConsegnaPrevista() || null)
      : null;

    // Ordine normale con date
    return {
      busta_id: busta.id,
      tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
      classificazione_lenti_id: nuovoOrdineForm.classificazione_lenti || null,
      trattamenti: nuovoOrdineForm.trattamenti.length > 0 ? nuovoOrdineForm.trattamenti : null,
      tipo_ordine_id: nuovoOrdineForm.tipo_ordine_id ? Number.parseInt(nuovoOrdineForm.tipo_ordine_id) : null,
      descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
      data_ordine: ordineGiaEffettuato ? nuovoOrdineForm.data_ordine : null,
      data_consegna_prevista: dataConsegnaPrevista,
      data_consegna_effettiva: dataConsegnaEffettiva,
      giorni_consegna_medi: nuovoOrdineForm.giorni_consegna_custom
        ? Number.parseInt(nuovoOrdineForm.giorni_consegna_custom)
        : getTempiConsegnaByCategoria(nuovoOrdineForm.categoria_prodotto, nuovoOrdineForm.tipo_lenti),
      stato: statoIniziale,
      da_ordinare: daOrdinare,
      note: formattedNote,
      ...fornitoreTableField
    };
  };

  const insertOrderToDatabase = async (orderData: any) => {
    const response = await fetch('/api/ordini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const result: CreateOrdineResponse = await response
      .json()
      .catch(() => ({} as CreateOrdineResponse));

    if (!response.ok || !result?.success || !result.ordine) {
      const message = result?.error || 'Errore creazione ordine';
      throw new Error(message);
    }

    return result.ordine;
  };

  // ===== DATA TRANSFORMATION =====
  const transformOrderData = (ordineCreato: any): OrdineMateriale => {
    return {
      ...ordineCreato,
      stato: ordineCreato.stato || 'ordinato',
      da_ordinare: ordineCreato.da_ordinare ?? true,
      needs_action: ordineCreato.needs_action ?? false,
      needs_action_done: ordineCreato.needs_action_done ?? false,
      needs_action_type: ordineCreato.needs_action_type || null,
      needs_action_due_date: ordineCreato.needs_action_due_date || null,
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
      classificazione_lenti: ordineCreato.classificazione_lenti && typeof ordineCreato.classificazione_lenti === 'object' && 'nome' in ordineCreato.classificazione_lenti
        ? ordineCreato.classificazione_lenti
        : ordineCreato.classificazione_lenti_id
          ? { nome: classificazioneLenti.find(c => c.id === ordineCreato.classificazione_lenti_id)?.nome || '' }
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
      primo_acquisto_lac: nuovoOrdineForm.primo_acquisto_lac,
      note: `Collegato all'ordine: ${nuovoOrdineForm.descrizione_prodotto}`,
      stato: 'attivo'
    };

    const response = await fetch('/api/materiali/lac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(materialeEntry)
    });

    const result = await response.json().catch(() => ({} as { success?: boolean; error?: string }));

    if (!response.ok || !result?.success) {
      console.error('⚠️ Errore gestione entry materiali LAC:', result?.error);
    }
  };

  // ===== FORM RESET =====
  const resetOrderForm = () => {
    setNuovoOrdineForm({
      categoria_prodotto: '',
      tipo_prodotto_assistenza: '', // ✅ NUOVO
      tipo_prodotto_ricambi: '', // ✅ NUOVO
      fornitore_id: '',
      tipo_lenti: '',
      classificazione_lenti: '',
      trattamenti: [],
      tipo_ordine_id: '',
      descrizione_prodotto: '',
      data_ordine: new Date().toISOString().split('T')[0],
      giorni_consegna_custom: '',
      note: '',
      primo_acquisto_lac: false,
      ordine_gia_effettuato: false,
      data_consegna_effettiva: ''
    });
    setShowNuovoOrdineForm(false);
    setEditingOrderId(null);
  };

  const openNewOrderForm = () => {
    setNuovoOrdineForm({
      categoria_prodotto: '',
      tipo_prodotto_assistenza: '',
      tipo_prodotto_ricambi: '',
      fornitore_id: '',
      tipo_lenti: '',
      classificazione_lenti: '',
      trattamenti: [],
      tipo_ordine_id: '',
      descrizione_prodotto: '',
      data_ordine: getDefaultOrderDate(),
      giorni_consegna_custom: '',
      note: '',
      primo_acquisto_lac: false,
      ordine_gia_effettuato: false,
      data_consegna_effettiva: ''
    });
    setEditingOrderId(null);
    setShowNuovoOrdineForm(true);
  };

  const resolveOrderCategory = (ordine: OrdineMateriale): Pick<NuovoOrdineForm, 'categoria_prodotto' | 'tipo_prodotto_assistenza' | 'tipo_prodotto_ricambi' | 'fornitore_id'> => {
    const categoriaRaw = (ordine.categoria_fornitore || '').toLowerCase();
    const supplierCandidates = [
      { value: ordine.fornitore_lenti_id, categoria: 'lenti', tipoAssistenza: 'lenti', tipoRicambi: null },
      { value: ordine.fornitore_lac_id, categoria: 'lac', tipoAssistenza: 'lac', tipoRicambi: null },
      { value: ordine.fornitore_montature_id, categoria: 'montature', tipoAssistenza: 'montature', tipoRicambi: 'montature' },
      { value: ordine.fornitore_lab_esterno_id, categoria: 'lab.esterno', tipoAssistenza: null, tipoRicambi: null },
      { value: ordine.fornitore_sport_id, categoria: 'sport', tipoAssistenza: 'sport', tipoRicambi: 'sport' },
      { value: ordine.fornitore_accessori_id, categoria: 'accessori', tipoAssistenza: 'accessori', tipoRicambi: 'accessori' }
    ];

    const match = supplierCandidates.find(item => item.value);
    const fornitoreId = match?.value || ordine.fornitore_id || '';

    if (categoriaRaw.includes('assistenza')) {
      return {
        categoria_prodotto: 'assistenza',
        tipo_prodotto_assistenza: (match?.tipoAssistenza as NuovoOrdineForm['tipo_prodotto_assistenza']) || '',
        tipo_prodotto_ricambi: '',
        fornitore_id: fornitoreId
      };
    }

    if (categoriaRaw.includes('ricambi')) {
      return {
        categoria_prodotto: 'ricambi',
        tipo_prodotto_assistenza: '',
        tipo_prodotto_ricambi: (match?.tipoRicambi as NuovoOrdineForm['tipo_prodotto_ricambi']) || '',
        fornitore_id: fornitoreId
      };
    }

    return {
      categoria_prodotto: (match?.categoria as NuovoOrdineForm['categoria_prodotto']) || '',
      tipo_prodotto_assistenza: '',
      tipo_prodotto_ricambi: '',
      fornitore_id: fornitoreId
    };
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
      if (ordineConTipiCorretti.note) {
        notifyNotesUpdated();
      }

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

  const buildEditOrderPayload = () => {
    const fornitoreTableField = getSupplierField();
    const tipoSelezionato = tipiOrdine.find(t => t.id === Number(nuovoOrdineForm.tipo_ordine_id));
    const isNegozio = tipoSelezionato?.nome?.toLowerCase() === 'negozio';

    const ordineGiaEffettuato = nuovoOrdineForm.ordine_gia_effettuato;
    const dataConsegnaEffettiva = ordineGiaEffettuato
      ? (nuovoOrdineForm.data_consegna_effettiva || null)
      : null;
    const dataOrdine = ordineGiaEffettuato ? (nuovoOrdineForm.data_ordine || null) : null;
    const dataConsegnaPrevista = ordineGiaEffettuato
      ? (calcolaDataConsegnaPrevista() || null)
      : null;

    const giorniConsegna = nuovoOrdineForm.giorni_consegna_custom
      ? Number.parseInt(nuovoOrdineForm.giorni_consegna_custom)
      : getTempiConsegnaByCategoria(nuovoOrdineForm.categoria_prodotto, nuovoOrdineForm.tipo_lenti);

    const cleanedNote = (nuovoOrdineForm.note ?? '').trim();

    const supplierReset = {
      fornitore_lenti_id: null,
      fornitore_lac_id: null,
      fornitore_montature_id: null,
      fornitore_lab_esterno_id: null,
      fornitore_sport_id: null,
      fornitore_accessori_id: null
    };

    const categoriaFornitore = nuovoOrdineForm.categoria_prodotto || null;

    if (isNegozio) {
      return {
        ...supplierReset,
        ...fornitoreTableField,
        categoria_fornitore: categoriaFornitore,
        tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
        classificazione_lenti_id: nuovoOrdineForm.classificazione_lenti || null,
        trattamenti: nuovoOrdineForm.trattamenti.length > 0 ? nuovoOrdineForm.trattamenti : null,
        tipo_ordine_id: Number.parseInt(nuovoOrdineForm.tipo_ordine_id),
        descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
        data_ordine: null,
        data_consegna_prevista: null,
        data_consegna_effettiva: null,
        giorni_consegna_medi: null,
        note: cleanedNote || null
      };
    }

    return {
      ...supplierReset,
      ...fornitoreTableField,
      categoria_fornitore: categoriaFornitore,
      tipo_lenti_id: nuovoOrdineForm.tipo_lenti || null,
      classificazione_lenti_id: nuovoOrdineForm.classificazione_lenti || null,
      trattamenti: nuovoOrdineForm.trattamenti.length > 0 ? nuovoOrdineForm.trattamenti : null,
      tipo_ordine_id: nuovoOrdineForm.tipo_ordine_id ? Number.parseInt(nuovoOrdineForm.tipo_ordine_id) : null,
      descrizione_prodotto: nuovoOrdineForm.descrizione_prodotto.trim(),
      data_ordine: dataOrdine,
      data_consegna_prevista: dataConsegnaPrevista,
      data_consegna_effettiva: dataConsegnaEffettiva,
      giorni_consegna_medi: giorniConsegna,
      note: cleanedNote || null
    };
  };

  const handleStartEditingOrder = (ordine: OrdineMateriale) => {
    if (!canEditOrder) return;

    const categoriaInfo = resolveOrderCategory(ordine);
    const ordineGiaEffettuato = Boolean(ordine.data_ordine || ordine.data_consegna_effettiva);
    const categoria = categoriaInfo.categoria_prodotto;

    setNuovoOrdineForm({
      ...categoriaInfo,
      tipo_lenti: categoria === 'lenti' ? (ordine.tipo_lenti_id || '') : '',
      classificazione_lenti: categoria === 'lenti' ? (ordine.classificazione_lenti_id || '') : '',
      trattamenti: categoria === 'lenti' ? (ordine.trattamenti || []) : [],
      tipo_ordine_id: ordine.tipo_ordine_id ? String(ordine.tipo_ordine_id) : '',
      descrizione_prodotto: ordine.descrizione_prodotto || '',
      data_ordine: formatDateForInput(ordine.data_ordine) || (ordineGiaEffettuato ? getDefaultOrderDate() : ''),
      giorni_consegna_custom: ordine.giorni_consegna_medi ? String(ordine.giorni_consegna_medi) : '',
      note: ordine.note || '',
      primo_acquisto_lac: false,
      ordine_gia_effettuato: ordineGiaEffettuato,
      data_consegna_effettiva: formatDateForInput(ordine.data_consegna_effettiva) || ''
    });

    setEditingOrderId(ordine.id);
    setShowNuovoOrdineForm(false);
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrderId || !canEditOrder) return;

    setIsSaving(true);
    try {
      validateOrderForm();

      const updates = buildEditOrderPayload();
      const updated = await patchOrdine(editingOrderId, updates);

      setOrdiniMateriali(prev =>
        prev.map(ordine => {
          if (ordine.id !== editingOrderId) return ordine;

          const next = {
            ...ordine,
            ...updates,
            updated_at: updated?.updated_at ?? ordine.updated_at,
            updated_by: updated?.updated_by ?? ordine.updated_by,
            fornitori_lenti: updates.fornitore_lenti_id
              ? { nome: fornitoriLenti.find(f => f.id === updates.fornitore_lenti_id)?.nome || '' }
              : null,
            fornitori_lac: updates.fornitore_lac_id
              ? { nome: fornitoriLac.find(f => f.id === updates.fornitore_lac_id)?.nome || '' }
              : null,
            fornitori_montature: updates.fornitore_montature_id
              ? { nome: fornitoriMontature.find(f => f.id === updates.fornitore_montature_id)?.nome || '' }
              : null,
            fornitori_lab_esterno: updates.fornitore_lab_esterno_id
              ? { nome: fornitoriLabEsterno.find(f => f.id === updates.fornitore_lab_esterno_id)?.nome || '' }
              : null,
            fornitori_sport: updates.fornitore_sport_id
              ? { nome: fornitoriSport.find(f => f.id === updates.fornitore_sport_id)?.nome || '' }
              : null,
            tipi_lenti: updates.tipo_lenti_id
              ? {
                  nome: tipiLenti.find(t => t.id === updates.tipo_lenti_id)?.nome || '',
                  giorni_consegna_stimati: tipiLenti.find(t => t.id === updates.tipo_lenti_id)?.giorni_consegna_stimati || null
                }
              : null,
            classificazione_lenti: updates.classificazione_lenti_id
              ? { nome: classificazioneLenti.find(c => c.id === updates.classificazione_lenti_id)?.nome || '' }
              : null,
            tipi_ordine: updates.tipo_ordine_id
              ? { nome: tipiOrdine.find(t => t.id === updates.tipo_ordine_id)?.nome || '' }
              : null
          };

          return next;
        })
      );

      await mutate('/api/buste');
      if (updates.note !== undefined) {
        notifyNotesUpdated();
      }

      resetOrderForm();
    } catch (error: any) {
      console.error('❌ Error updating ordine:', error);
      alert(`Errore aggiornamento: ${error.message}`);
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
      const dataOrdine = ordine.data_ordine || oggi;
      let updateData: any = {
        da_ordinare: newValue,
        stato: newValue ? 'da_ordinare' : 'ordinato',
      };

      // 🔥 CORREZIONE: Quando l'ordine viene piazzato (da_ordinare = false)
      if (!newValue) {
        // Imposta data ordine a oggi
        updateData.data_ordine = dataOrdine;
        // Ricalcola data consegna prevista basata su OGGI
        updateData.data_consegna_prevista = calcolaDataConsegnaPerOrdineEsistente(ordine, dataOrdine);
        console.log(`📅 Ricalcolo consegna: ordine piazzato ${dataOrdine} → consegna prevista ${updateData.data_consegna_prevista}`);
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
  const createAutoErrorDraft = async (ordine: OrdineMateriale) => {
    try {
      const response = await fetch('/api/error-tracking/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordineId: ordine.id })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('❌ Errore creazione bozza errore:', payload);
        alert(payload?.error || `Impossibile creare automaticamente la bozza errore. Codice: ${response.status}`);
        return;
      }

      if (payload?.alreadyExists) {
        console.log('ℹ️ Bozza errore già presente per ordine', ordine.id);
        return;
      }

      alert('Bozza errore generata automaticamente. Un admin completerà la registrazione.');
      window.dispatchEvent(new CustomEvent('errorDrafts:update', { detail: { delta: 1 } }));
    } catch (error) {
      console.error('❌ Errore nella richiesta di bozza errore:', error);
      alert('Errore imprevisto durante la creazione della bozza errore.');
    }
  };

  const handleAggiornaStatoOrdine = async (ordineId: string, nuovoStato: string) => {
    if (!canEdit) return;
    try {
      console.log('🔄 Aggiornamento stato ordine:', ordineId, nuovoStato);
      const ordineCorrente = ordiniMateriali.find((ordine) => ordine.id === ordineId);

      if (!ordineCorrente) {
        alert('Ordine non trovato. Aggiornare la pagina e riprovare.');
        return;
      }

      if (nuovoStato === 'annullato') {
        setCancelOrderId(ordineId);
        setCancelReason('');
        setCancelNote('');
        return;
      }

      let shouldCreateDraft = false;

      if (nuovoStato === 'sbagliato') {
        // ✅ Reindirizza al form EVENTO con tipo "prodotto_errato" preselezionato
        setEventOrderId(ordineId);
        setEventForm({
          type: 'prodotto_errato',
          description: '',
          actionRequired: 'none',
          dueDate: '',
          actionDoneNow: false,
          colpaErrore: ''
        });
        setEventErrors({});
        return;
      }
      
      const updateData: any = {
        stato: nuovoStato,
        updated_at: new Date().toISOString()
      };

      if (nuovoStato === 'consegnato') {
        updateData.data_consegna_effettiva = ordineCorrente.data_consegna_effettiva
          || new Date().toISOString().split('T')[0];
      } else if (nuovoStato === 'sbagliato') {
        updateData.data_consegna_effettiva = null;
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

      if (shouldCreateDraft) {
        await createAutoErrorDraft(ordineCorrente);
      }

    } catch (error: any) {
      console.error('❌ Error updating ordine:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  const handleAggiornaDisponibilita = async (
    ordineId: string,
    nuovoStato: 'disponibile' | 'riassortimento' | 'esaurito'
  ) => {
    if (!canEdit) return;
    try {
      const corrente = ordiniMateriali.find(o => o.id === ordineId);
      if (!corrente) {
        alert('Ordine non trovato. Aggiornare la pagina e riprovare.');
        return;
      }
      const statoCorrente = (corrente.stato_disponibilita || 'disponibile') as typeof DISPONIBILITA_STATES[number];
      if (statoCorrente === nuovoStato) {
        return;
      }

      let promemoria: string | null = corrente.promemoria_disponibilita || null;
      if (nuovoStato === 'disponibile') {
        promemoria = null;
      } else {
        const reminder = new Date();
        reminder.setHours(9, 0, 0, 0);
        reminder.setDate(reminder.getDate() + (nuovoStato === 'riassortimento' ? 3 : 1));
        promemoria = reminder.toISOString();
      }

      const hasOpenAction = Boolean(corrente.needs_action && !corrente.needs_action_done);
      const actionRequired = nuovoStato !== 'disponibile';
      const dueDate = actionRequired ? getTomorrowDateInput() : null;

      let noteMessage = '';
      if (nuovoStato === 'riassortimento') {
        noteMessage = 'Fornitore comunica RIASSORTIMENTO. Cliente da avvisare.';
      } else if (nuovoStato === 'esaurito') {
        noteMessage = 'Fornitore comunica ESAURITO. Cliente da avvisare.';
      } else {
        noteMessage = 'Disponibilità ripristinata dal fornitore.';
      }

      const noteLine = buildNoteLine(noteMessage, currentUserLabel);
      const noteAggiornate = appendNoteLine(corrente.note, noteLine);

      const updates: Record<string, any> = {
        stato_disponibilita: nuovoStato,
        promemoria_disponibilita: promemoria,
        note: noteAggiornate
      };

      if (actionRequired) {
        updates.needs_action_due_date = dueDate;
        if (!hasOpenAction) {
          updates.needs_action = true;
          updates.needs_action_done = false;
          updates.needs_action_type = 'CALL_CLIENT';
        }
      }

      await patchOrdine(ordineId, updates);

      setOrdiniMateriali(prev =>
        prev.map(ordine =>
          ordine.id === ordineId
            ? {
                ...ordine,
                ...updates
              }
            : ordine
        )
      );

      await mutate('/api/buste');
      notifyNotesUpdated();

      if (actionRequired && (!hasOpenAction || corrente.needs_action_type === 'CALL_CLIENT')) {
        setAvailabilityPrompt({ ordineId, stato: nuovoStato });
      }
    } catch (error: any) {
      console.error('❌ Errore aggiornamento disponibilità:', error);
      alert(`Errore aggiornamento disponibilità: ${error.message}`);
    }
  };

  const handleAggiornaPromemoriaDisponibilita = async (ordineId: string, value: string) => {
    try {
      const isoValue = toIsoDate(value);

      const response = await fetch(`/api/ordini/${ordineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promemoria_disponibilita: isoValue
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Impossibile aggiornare il promemoria');
      }

      setOrdiniMateriali(prev =>
        prev.map(ordine =>
          ordine.id === ordineId
            ? { ...ordine, promemoria_disponibilita: isoValue }
            : ordine
        )
      );

      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Errore aggiornamento promemoria:', error);
      alert(`Errore aggiornamento promemoria: ${error.message}`);
    }
  };

  // ===== HANDLE DELETE ORDINE - VERSIONE ESISTENTE =====
  const handleDeleteOrdine = async (ordineId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo ordine?')) {
      return;
    }

    try {
      console.log('🗑️ Eliminazione ordine:', ordineId);

      const response = await fetch(`/api/ordini/${ordineId}`, {
        method: 'DELETE'
      });

      const payload: DeleteOrdineResponse = await response
        .json()
        .catch(() => ({} as DeleteOrdineResponse));

      if (!response.ok || !payload?.success) {
        const message = payload?.error || 'Errore eliminazione ordine';
        throw new Error(message);
      }

      console.log('✅ Ordine eliminato dal database');

      // ✅ FIX: Use functional update to avoid stale closure issue
      // when deleting multiple orders in quick succession
      setOrdiniMateriali(prev => {
        const ordiniAggiornati = prev.filter(ordine => ordine.id !== ordineId);

        // Sync workflow with remaining orders (async, after state update)
        if (ordiniAggiornati.length > 0) {
          syncBustaWorkflowWithOrdini(ordiniAggiornati, 'eliminazione ordine');
        }

        return ordiniAggiornati;
      });

      // ✅ SWR: Invalidate cache after order deletion
      await mutate('/api/buste');

    } catch (error: any) {
      console.error('❌ Error deleting ordine:', error);
      alert(`Errore eliminazione: ${error.message}`);
    }
  };

  // ===== HANDLE EDIT DESCRIZIONE PRODOTTO =====
  const handleStartEditingDescription = (ordineId: string, currentDescription: string) => {
    setEditingDescriptionId(ordineId);
    setEditingDescriptionValue(currentDescription);
  };

  const handleCancelEditingDescription = () => {
    setEditingDescriptionId(null);
    setEditingDescriptionValue('');
  };

  const handleSaveDescription = async (ordineId: string) => {
    const trimmedValue = editingDescriptionValue.trim();

    if (!trimmedValue) {
      alert('La descrizione del prodotto non può essere vuota');
      return;
    }

    try {
      // Find the order to get old value
      const ordine = ordiniMateriali.find(o => o.id === ordineId);
      if (!ordine) {
        throw new Error('Ordine non trovato');
      }

      const oldValue = ordine.descrizione_prodotto;

      const response = await fetch(`/api/ordini/${ordineId}/description`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descrizione_prodotto: trimmedValue })
      });

      const result: UpdateOrdineDescriptionResponse = await response
        .json()
        .catch(() => ({} as UpdateOrdineDescriptionResponse));

      if (!response.ok || !result?.success) {
        const message = result?.error || 'Errore aggiornamento descrizione';
        throw new Error(message);
      }

      const updatedOrdine = result.ordine;

      console.info('ORDER_DESCRIPTION_UPDATE', {
        orderId: ordineId,
        bustaId: busta.id,
        oldValue,
        newValue: updatedOrdine?.descrizione_prodotto ?? trimmedValue,
        changedFields: ['descrizione_prodotto'],
        timestamp: new Date().toISOString()
      });

      // Aggiorna la lista locale
      const ordiniAggiornati = ordiniMateriali.map(o =>
        o.id === ordineId
          ? {
              ...o,
              descrizione_prodotto: updatedOrdine?.descrizione_prodotto ?? trimmedValue,
              updated_by: updatedOrdine?.updated_by ?? o.updated_by,
              updated_at: updatedOrdine?.updated_at ?? o.updated_at
            }
          : o
      );
      setOrdiniMateriali(ordiniAggiornati);

      // Reset edit state
      setEditingDescriptionId(null);
      setEditingDescriptionValue('');

      // ✅ SWR: Invalidate cache
      await mutate('/api/buste');

    } catch (error: any) {
      console.error('❌ Error updating description:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  // ===== HANDLE EDIT NOTE ORDINE =====
  const handleStartEditingNote = (ordineId: string) => {
    setEditingNoteId(ordineId);
    setEditingNoteValue('');
  };

  const handleCancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const handleSaveNote = async (ordineId: string) => {
    const trimmedValue = normalizeNoteMessage(editingNoteValue);

    if (!canEdit || isSavingNote) return;
    if (!trimmedValue) {
      alert('Scrivi una nota prima di salvare.');
      return;
    }

    setIsSavingNote(true);
    try {
      const ordine = ordiniMateriali.find(o => o.id === ordineId);
      if (!ordine) {
        throw new Error('Ordine non trovato');
      }

      const noteLine = buildNoteLine(trimmedValue, currentUserLabel);
      const notePayload = appendNoteLine(ordine.note, noteLine);

      const updated = await patchOrdine(ordineId, { note: notePayload });

      setOrdiniMateriali(prev => prev.map((item) =>
        item.id === ordineId
          ? {
              ...item,
              note: notePayload,
              updated_at: updated?.updated_at ?? item.updated_at,
              updated_by: updated?.updated_by ?? item.updated_by
            }
          : item
      ));

      setEditingNoteId(null);
      setEditingNoteValue('');

      await mutate('/api/buste');
      notifyNotesUpdated();
    } catch (error: any) {
      console.error('❌ Error updating note:', error);
      alert(`Errore aggiornamento note: ${error.message}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  const openEventModal = (ordineId: string) => {
    setEventOrderId(ordineId);
    setEventForm({
      type: '',
      description: '',
      actionRequired: 'none',
      dueDate: '',
      actionDoneNow: false,
      colpaErrore: ''
    });
    setEventErrors({});
  };

  const closeEventModal = () => {
    setEventOrderId(null);
    setEventErrors({});
    setEventForm(prev => ({ ...prev, colpaErrore: '' }));
  };

  const handleEventTypeChange = (value: EventType | '') => {
    setEventForm(prev => ({
      ...prev,
      type: value,
      actionRequired: value === 'serve_cliente' ? 'MID_PROCESS' : prev.actionRequired
    }));
  };

  const handleSaveEvent = async () => {
    if (!eventOrderId) return;

    const ordine = ordiniMateriali.find(o => o.id === eventOrderId);
    if (!ordine) {
      alert('Ordine non trovato.');
      return;
    }

    const tipoEvento = eventForm.type;
    const descrizione = normalizeNoteMessage(eventForm.description);

    // ✅ Validazione con campo colpa per prodotto_errato
    const errors: { type?: string; description?: string; colpa?: string } = {};
    if (!tipoEvento) errors.type = 'Seleziona un tipo di evento.';
    if (!descrizione) errors.description = 'Scrivi una descrizione breve.';
    if (tipoEvento === 'prodotto_errato' && !eventForm.colpaErrore) {
      errors.colpa = 'Specifica di chi è la colpa.';
    }
    setEventErrors(errors);

    if (!tipoEvento || !descrizione) return;
    if (tipoEvento === 'prodotto_errato' && !eventForm.colpaErrore) return;

    const enforcedAction: ActionRequiredValue =
      tipoEvento === 'serve_cliente' ? 'MID_PROCESS' : eventForm.actionRequired;
    const actionOption = ACTION_REQUIRED_OPTIONS.find(option => option.value === enforcedAction);
    const actionLabel = actionOption?.label ?? 'Nessuna';

    // ✅ Costruisci messaggio nota con info colpa se prodotto_errato
    const eventLabel = EVENT_LABELS[tipoEvento];
    let noteMessage = `EVENTO — ${eventLabel}. ${descrizione}.`;

    if (tipoEvento === 'prodotto_errato' && eventForm.colpaErrore) {
      const colpaLabels: Record<string, string> = {
        'errore_interno': 'Errore interno (nostro)',
        'errore_cliente': 'Errore cliente',
        'errore_fornitore': 'Errore fornitore'
      };
      noteMessage = `EVENTO — ${eventLabel}. Colpa: ${colpaLabels[eventForm.colpaErrore]}. ${descrizione}.`;
    }

    noteMessage += ` Azione: ${actionLabel}.`;
    let updatedNote = appendNoteLine(ordine.note, buildNoteLine(noteMessage, currentUserLabel));

    const updates: Record<string, any> = { note: updatedNote };
    const actionRequired = enforcedAction !== 'none';

    // ✅ Se prodotto_errato, cambia anche lo stato a "sbagliato"
    if (tipoEvento === 'prodotto_errato') {
      updates.stato = 'sbagliato';
      updates.data_consegna_effettiva = null;
    }

    if (actionRequired) {
      const hasOpenAction = Boolean(ordine.needs_action && !ordine.needs_action_done);
      const dueDate = eventForm.dueDate || getTomorrowDateInput();

      if (!hasOpenAction) {
        updates.needs_action = true;
        updates.needs_action_done = false;
        updates.needs_action_type = enforcedAction;
      }

      updates.needs_action_due_date = eventForm.actionDoneNow
        ? (eventForm.dueDate || ordine.needs_action_due_date || null)
        : dueDate;

      if (eventForm.actionDoneNow) {
        updates.needs_action = true;
        updates.needs_action_done = true;
        if (!hasOpenAction) {
          updates.needs_action_type = enforcedAction;
        }

        const completionLabel = ACTION_COMPLETION_LABELS[enforcedAction as NeedsActionType] || 'Azione completata';
        updatedNote = appendNoteLine(
          updatedNote,
          buildNoteLine(`Azione completata: ${completionLabel}.`, currentUserLabel)
        );
        updates.note = updatedNote;
      }
    }

    try {
      await patchOrdine(eventOrderId, updates);

      let ordiniAggiornati: OrdineMateriale[] = [];
      setOrdiniMateriali(prev => {
        const next = prev.map(item =>
          item.id === eventOrderId
            ? { ...item, ...updates }
            : item
        );
        ordiniAggiornati = next;
        return next;
      });

      await mutate('/api/buste');
      notifyNotesUpdated();

      // ✅ Se prodotto_errato, sincronizza workflow e crea bozza ET2.0
      if (tipoEvento === 'prodotto_errato') {
        await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'evento prodotto_errato');
        await createAutoErrorDraft(ordine);
      }

      closeEventModal();
    } catch (error: any) {
      console.error('❌ Error saving event:', error);
      alert(`Errore salvataggio evento: ${error.message}`);
    }
  };

  const handleAvailabilityPromptChoice = async (confirmed: boolean) => {
    if (!availabilityPrompt) return;
    const { ordineId } = availabilityPrompt;
    setAvailabilityPrompt(null);
    if (!confirmed) return;

    const ordine = ordiniMateriali.find(o => o.id === ordineId);
    if (!ordine) return;

    const actionType = (ordine.needs_action_type || 'CALL_CLIENT') as NeedsActionType;
    const completionLabel = ACTION_COMPLETION_LABELS[actionType] || 'Azione completata';
    const noteLine = buildNoteLine(`Azione completata: ${completionLabel}.`, currentUserLabel);
    const notePayload = appendNoteLine(ordine.note, noteLine);

    const updates: Record<string, any> = {
      needs_action: true,
      needs_action_done: true,
      needs_action_type: ordine.needs_action_type || 'CALL_CLIENT',
      note: notePayload
    };

    try {
      await patchOrdine(ordineId, updates);
      setOrdiniMateriali(prev =>
        prev.map(item =>
          item.id === ordineId
            ? { ...item, ...updates }
            : item
        )
      );
      await mutate('/api/buste');
      notifyNotesUpdated();
    } catch (error: any) {
      console.error('❌ Error completing action:', error);
      alert(`Errore aggiornamento azione: ${error.message}`);
    }
  };

  const handleCompleteAction = async (ordineId: string) => {
    const ordine = ordiniMateriali.find(o => o.id === ordineId);
    if (!ordine) return;
    const confirmed = window.confirm('Vuoi segnare questa azione come completata?');
    if (!confirmed) return;

    const actionType = (ordine.needs_action_type || 'OTHER') as NeedsActionType;
    const completionLabel = ACTION_COMPLETION_LABELS[actionType] || 'Azione completata';
    const noteLine = buildNoteLine(`Azione completata: ${completionLabel}.`, currentUserLabel);
    const notePayload = appendNoteLine(ordine.note, noteLine);

    const updates: Record<string, any> = {
      needs_action: true,
      needs_action_done: true,
      note: notePayload
    };
    if (!ordine.needs_action_type) {
      updates.needs_action_type = actionType;
    }

    try {
      await patchOrdine(ordineId, updates);
      setOrdiniMateriali(prev =>
        prev.map(item =>
          item.id === ordineId
            ? { ...item, ...updates }
            : item
        )
      );
      await mutate('/api/buste');
      notifyNotesUpdated();
      setActionMenuId(null);
    } catch (error: any) {
      console.error('❌ Error completing action:', error);
      alert(`Errore aggiornamento azione: ${error.message}`);
    }
  };

  const handleUpdateActionDueDate = async (ordineId: string, value: string) => {
    if (!canEdit) return;
    const isoValue = value || null;
    try {
      await patchOrdine(ordineId, { needs_action_due_date: isoValue });
      setOrdiniMateriali(prev =>
        prev.map(item =>
          item.id === ordineId
            ? { ...item, needs_action_due_date: isoValue }
            : item
        )
      );
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error updating action due date:', error);
      alert(`Errore aggiornamento scadenza: ${error.message}`);
    }
  };

  const resolveCategoriaForDuplica = (ordine: OrdineMateriale) => {
    if (ordine.fornitore_lenti_id) return 'lenti';
    if (ordine.fornitore_lac_id) return 'lac';
    if (ordine.fornitore_montature_id) return 'montature';
    if (ordine.fornitore_lab_esterno_id) return 'lab.esterno';
    if (ordine.fornitore_sport_id) return 'sport';
    if (ordine.fornitore_accessori_id) return 'accessori';
    return '';
  };

  const handleDuplicateOrder = (ordine: OrdineMateriale) => {
    const categoria = resolveCategoriaForDuplica(ordine);
    if (!categoria) {
      alert('Impossibile duplicare: categoria non riconosciuta.');
      return;
    }

    const supplierId =
      ordine.fornitore_lenti_id ||
      ordine.fornitore_lac_id ||
      ordine.fornitore_montature_id ||
      ordine.fornitore_lab_esterno_id ||
      ordine.fornitore_sport_id ||
      ordine.fornitore_accessori_id ||
      '';

    setNuovoOrdineForm({
      categoria_prodotto: categoria as typeof nuovoOrdineForm.categoria_prodotto,
      tipo_prodotto_assistenza: '',
      tipo_prodotto_ricambi: '',
      fornitore_id: supplierId,
      tipo_lenti: ordine.tipo_lenti_id || '',
      classificazione_lenti: ordine.classificazione_lenti_id || '',
      trattamenti: ordine.trattamenti || [],
      tipo_ordine_id: ordine.tipo_ordine_id ? String(ordine.tipo_ordine_id) : '',
      descrizione_prodotto: ordine.descrizione_prodotto || '',
      data_ordine: getDefaultOrderDate(),
      giorni_consegna_custom: '',
      note: '',
      primo_acquisto_lac: false,
      ordine_gia_effettuato: false,
      data_consegna_effettiva: ''
    });

    setShowNuovoOrdineForm(true);
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelOrderId) return;
    const ordine = ordiniMateriali.find(o => o.id === cancelOrderId);
    if (!ordine) {
      setCancelOrderId(null);
      return;
    }

    if (!cancelReason) {
      alert('Seleziona un motivo di annullo.');
      return;
    }

    const trimmedNote = normalizeNoteMessage(cancelNote);
    if (cancelReason === 'Altro' && !trimmedNote) {
      alert('Inserisci una nota per il motivo "Altro".');
      return;
    }

    setIsCancellingOrder(true);

    const noteMessage = `Ordine ANNULLATO. Motivo: ${cancelReason}${trimmedNote ? `. ${trimmedNote}` : ''}`;
    const noteLine = buildNoteLine(noteMessage, currentUserLabel);
    const notePayload = appendNoteLine(ordine.note, noteLine);

    const updates: Record<string, any> = {
      stato: 'annullato',
      da_ordinare: false,
      data_ordine: null,
      data_consegna_prevista: null,
      data_consegna_effettiva: null,
      cancel_reason: cancelReason,
      note: notePayload
    };

    try {
      await patchOrdine(cancelOrderId, updates);

      let ordiniAggiornati: OrdineMateriale[] = [];
      setOrdiniMateriali(prev => {
        const next = prev.map(item =>
          item.id === cancelOrderId
            ? { ...item, ...updates }
            : item
        );
        ordiniAggiornati = next;
        return next;
      });

      await mutate('/api/buste');
      notifyNotesUpdated();
      await syncBustaWorkflowWithOrdini(ordiniAggiornati, 'annullamento ordine');

      setCancelOrderId(null);
      setCancelReason('');
      setCancelNote('');
    } catch (error: any) {
      console.error('❌ Error cancelling ordine:', error);
      alert(`Errore annullamento: ${error.message}`);
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleSaveSospesaFollowup = async () => {
    if (!canEdit) return;
    if (!sospesaFollowupReason) {
      alert('Seleziona un esito per il follow-up.');
      return;
    }
    const trimmedNote = normalizeNoteMessage(sospesaFollowupNote);
    if (!trimmedNote) {
      alert('Inserisci una nota per il follow-up.');
      return;
    }

    setIsSavingSospesaFollowup(true);
    const doneAt = new Date().toISOString();
    const noteMessage = `FOLLOW-UP SOSPESA — Esito: ${sospesaFollowupReason}. Nota: ${trimmedNote}`;

    try {
      await appendBustaNote(noteMessage, currentUserLabel, {
        sospesa_followup_done_at: doneAt,
        sospesa_followup_reason: sospesaFollowupReason,
        sospesa_followup_note: trimmedNote
      });
      setSospesaFollowupDoneAt(doneAt);
      setShowSospesaFollowupModal(false);
      setSospesaFollowupReason('');
      setSospesaFollowupNote('');
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error saving sospesa follow-up:', error);
      alert(`Errore salvataggio follow-up: ${error.message}`);
    } finally {
      setIsSavingSospesaFollowup(false);
    }
  };

  const renderOrderForm = (title: string, onClose: () => void, onSave: () => void) => {
    const orderFormError = getOrderFormValidationError();

    return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button
          onClick={onClose}
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
            {[
              { value: 'lenti', label: '🔍 Lenti', desc: 'Lenti da vista/sole graduate' },
              { value: 'lac', label: '👁️ LAC', desc: 'Lenti a Contatto' },
              { value: 'montature', label: '👓 Montature', desc: 'Occhiali/Sole' },
              { value: 'lab.esterno', label: '🏭 Lab.Esterno', desc: 'Lavorazioni Esterne' },
              { value: 'sport', label: '🏃 Sport', desc: 'Articoli Sportivi' },
              { value: 'accessori', label: '📎 Accessori e Liquidi', desc: 'Custodie, cordini, liquidi, panni, etc.' },
              { value: 'assistenza', label: '🔧 Assistenza', desc: 'Riparazioni e servizi' },
              { value: 'ricambi', label: '🔩 RICAMBI', desc: 'Aste, minuterie e lenti da sole neutre' }
            ].map(categoria => (
              <button
                key={categoria.value}
                onClick={() => setNuovoOrdineForm(prev => ({
                  ...prev,
                  categoria_prodotto: categoria.value as any,
                  tipo_prodotto_assistenza: '',
                  tipo_prodotto_ricambi: '',
                  fornitore_id: '',
                  tipo_lenti: '',
                  classificazione_lenti: '',
                  trattamenti: [],
                  primo_acquisto_lac: false
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

        {/* ===== STEP 1.5: TIPO PRODOTTO ASSISTENZA ===== */}
        {nuovoOrdineForm.categoria_prodotto === 'assistenza' && (
          <div className="lg:col-span-3">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                2. Tipo Prodotto *
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { value: 'lenti', label: '🔍 Lenti', desc: 'Lenti oftalmiche' },
                  { value: 'montature', label: '👓 Montature', desc: 'Occhiali' },
                  { value: 'lac', label: '👁️ LAC', desc: 'Lenti a contatto' },
                  { value: 'sport', label: '🏃 Sport', desc: 'Articoli sportivi' },
                  { value: 'accessori', label: '📎 Accessori e Liquidi', desc: 'Accessori e liquidi' }
                ].map(tipo => (
                  <button
                    key={tipo.value}
                    onClick={() => setNuovoOrdineForm(prev => ({
                      ...prev,
                      tipo_prodotto_assistenza: tipo.value as any,
                      fornitore_id: ''
                    }))}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      nuovoOrdineForm.tipo_prodotto_assistenza === tipo.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{tipo.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{tipo.desc}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* ===== STEP 1.5: TIPO PRODOTTO RICAMBI ===== */}
        {nuovoOrdineForm.categoria_prodotto === 'ricambi' && (
          <div className="lg:col-span-3">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                2. Tipo Prodotto *
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'montature', label: '👓 Montature', desc: 'Ricambi per occhiali' },
                  { value: 'sport', label: '🏃 Sport', desc: 'Ricambi articoli sportivi' },
                  { value: 'accessori', label: '📎 Accessori e Liquidi', desc: 'Ricambi accessori e liquidi' },
                  { value: 'lenti', label: '🔍 Lenti', desc: 'Lenti da sole neutre' }
                ].map(tipo => (
                  <button
                    key={tipo.value}
                    onClick={() => setNuovoOrdineForm(prev => ({
                      ...prev,
                      tipo_prodotto_ricambi: tipo.value as any,
                      fornitore_id: ''
                    }))}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      nuovoOrdineForm.tipo_prodotto_ricambi === tipo.value
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{tipo.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{tipo.desc}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* ===== STEP 2: TIPO LENTI (solo per categoria lenti) ===== */}
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
            {nuovoOrdineForm.categoria_prodotto === 'lenti'
              ? '3. Fornitore *'
              : nuovoOrdineForm.categoria_prodotto === 'assistenza'
              ? '3. Fornitore *'
              : '2. Fornitore *'}
          </label>
          <select
            value={nuovoOrdineForm.fornitore_id}
            onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, fornitore_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={
              !nuovoOrdineForm.categoria_prodotto ||
              (nuovoOrdineForm.categoria_prodotto === 'assistenza' && !nuovoOrdineForm.tipo_prodotto_assistenza) ||
              (nuovoOrdineForm.categoria_prodotto === 'ricambi' && !nuovoOrdineForm.tipo_prodotto_ricambi)
            }
          >
            <option value="">
              {((nuovoOrdineForm.categoria_prodotto === 'assistenza' && !nuovoOrdineForm.tipo_prodotto_assistenza) ||
                (nuovoOrdineForm.categoria_prodotto === 'ricambi' && !nuovoOrdineForm.tipo_prodotto_ricambi))
                ? '-- Prima seleziona il tipo prodotto --'
                : '-- Seleziona fornitore --'}
            </option>
            {getFornitoriDisponibili().map(f => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {/* ===== CHECKBOX PRIMO ACQUISTO LAC ===== */}
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

        {/* ===== CLASSIFICAZIONE LENTI (solo per categoria lenti) ===== */}
        {nuovoOrdineForm.categoria_prodotto === 'lenti' && (
          <div>
            <label htmlFor="classificazione-lenti" className="block text-sm font-medium text-gray-700 mb-1">
              Classificazione Lenti *
            </label>
            <select
              id="classificazione-lenti"
              value={nuovoOrdineForm.classificazione_lenti}
              onChange={(e) => setNuovoOrdineForm(prev => ({ ...prev, classificazione_lenti: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Seleziona classificazione --</option>
              {classificazioneLenti.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* ===== TRATTAMENTI (solo per categoria lenti) ===== */}
        {nuovoOrdineForm.categoria_prodotto === 'lenti' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trattamenti *
              <span className="text-xs text-gray-500 ml-1">(multi-selezione)</span>
            </label>
            <select
              multiple
              size={5}
              value={nuovoOrdineForm.trattamenti}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setNuovoOrdineForm(prev => {
                  const hasNessuno = selected.includes(LENS_TREATMENTS.NESSUNO);
                  const hadNessuno = prev.trattamenti.includes(LENS_TREATMENTS.NESSUNO);

                  if (hasNessuno && !hadNessuno) {
                    return { ...prev, trattamenti: [LENS_TREATMENTS.NESSUNO] };
                  }

                  if (hasNessuno && selected.length > 1) {
                    return { ...prev, trattamenti: selected.filter(value => value !== LENS_TREATMENTS.NESSUNO) };
                  }

                  return { ...prev, trattamenti: selected };
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {LENS_TREATMENTS_OPTIONS.map(treatment => (
                <option key={treatment.value} value={treatment.value}>
                  {nuovoOrdineForm.trattamenti.includes(treatment.value) ? '✓ ' : '   '}{treatment.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Seleziona almeno un trattamento o "Nessuno". Ctrl+click (o Cmd+click su Mac) per selezionare più opzioni
            </p>
          </div>
        )}

        {/* ===== MODALITÀ ORDINE ===== */}
        <div>
          <label htmlFor="modalita-ordine" className="block text-sm font-medium text-gray-700 mb-1">
            Modalità Ordine *
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

        {/* ===== GESTIONE DATE E TEMPI ===== */}
        {(() => {
          const tipoSelezionato = tipiOrdine.find(t => t.id === Number(nuovoOrdineForm.tipo_ordine_id));
          const isNegozio = tipoSelezionato?.nome?.toLowerCase() === 'negozio';
          return !isNegozio ? (
            <>
              <div className="lg:col-span-3">
                <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={nuovoOrdineForm.ordine_gia_effettuato}
                    onChange={(e) =>
                      setNuovoOrdineForm(prev => ({
                        ...prev,
                        ordine_gia_effettuato: e.target.checked,
                        data_consegna_effettiva: e.target.checked ? prev.data_consegna_effettiva : '',
                        data_ordine: e.target.checked
                          ? (prev.data_ordine && prev.data_ordine !== new Date().toISOString().split('T')[0]
                              ? prev.data_ordine
                              : getDefaultOrderDate())
                          : prev.data_ordine
                      }))
                    }
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-blue-900">
                      Ordine già effettuato (inserimento storico)
                    </span>
                    <p className="text-xs text-blue-700 mt-1">
                      Seleziona quando l&apos;ordine è stato già fatto in passato. Useremo la data ordine inserita
                      e potrai indicare la data di arrivo se già consegnato.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label htmlFor="data-ordine" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Ordine {nuovoOrdineForm.ordine_gia_effettuato ? '(effettiva)' : '(stimata)'}
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

              {nuovoOrdineForm.ordine_gia_effettuato && (
                <div>
                  <label htmlFor="data-consegna-effettiva" className="block text-sm font-medium text-gray-700 mb-1">
                    Data Arrivo Effettiva (se già consegnato)
                  </label>
                  <input
                    id="data-consegna-effettiva"
                    type="date"
                    value={nuovoOrdineForm.data_consegna_effettiva}
                    onChange={(e) =>
                      setNuovoOrdineForm(prev => ({ ...prev, data_consegna_effettiva: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
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
          {orderFormError && (
            <div className="text-xs text-red-600 mt-1">
              {orderFormError}
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onSave}
            disabled={Boolean(orderFormError) || isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>{editingOrderId ? 'Salva Modifiche' : 'Salva Ordine'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
  }

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

      {busta.is_suspended && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Busta sospesa</h3>
            <p className="text-sm text-yellow-700">
              Follow-up richiesto per la busta sospesa.
            </p>
            {sospesaFollowupDoneAt && (
              <p className="text-xs text-yellow-700 mt-1">
                Follow-up registrato.
              </p>
            )}
          </div>
          {canEdit && !sospesaFollowupDoneAt && (
            <button
              onClick={() => setShowSospesaFollowupModal(true)}
              className="px-3 py-2 text-sm text-yellow-900 bg-yellow-100 border border-yellow-200 rounded hover:bg-yellow-200"
            >
              Esito follow-up
            </button>
          )}
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
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm animate-fade-in">
        <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <ShoppingCart className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Materiali & Ordini
              </h2>
              <p className="text-sm text-slate-600">
                Gestione ordini presso fornitori per questa busta
              </p>
            </div>
          </div>
          
          {/* ✅ MODIFICA: PULSANTE NUOVO ORDINE - NASCOSTO PER OPERATORI */}
          {canEdit && (
            <button
              onClick={openNewOrderForm}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nuovo Ordine</span>
            </button>
          )}
        </div>
      </div>

      {/* ✅ MODIFICA: Form Nuovo Ordine - NASCOSTO PER OPERATORI */}
      {canEdit && showNuovoOrdineForm && !editingOrderId && (
        renderOrderForm('Nuovo Ordine Materiale', resetOrderForm, handleSalvaNuovoOrdine)
      )}

      {/* Lista Ordini */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-sm animate-slide-up">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
              <Truck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Ordini per questa Busta
              </h3>
              {ordiniMateriali.length > 0 && (
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {ordiniMateriali.length}
                </span>
              )}
              {showDisponibilitaBadge && (
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full border ${DISPONIBILITA_BADGE[disponibilitaStats.worstStatus].className}`}
                >
                  {DISPONIBILITA_BADGE[disponibilitaStats.worstStatus].label}
                </span>
              )}
            </div>
          </div>
          {showDisponibilitaBadge && disponibilitaReminderLabel && (
            <div className="flex items-center text-xs">
              <Clock className={`w-3 h-3 mr-1 ${promemoriaDisponibilitaScaduto ? 'text-red-500' : 'text-slate-400'}`} />
              <span className={promemoriaDisponibilitaScaduto ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                Prossimo controllo disponibilità: {disponibilitaReminderLabel}
              </span>
            </div>
          )}
        </div>

        {isLoadingOrdini ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Caricamento ordini...</p>
          </div>
        ) : ordiniMateriali.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h4 className="text-lg font-semibold text-slate-900 mb-2">Nessun ordine ancora</h4>
            <p className="text-sm text-slate-500 mb-4">
              {canEdit ? 'Inizia creando il primo ordine per questa busta' : 'Non ci sono ordini per questa busta'}
            </p>
            {/* ✅ MODIFICA: PULSANTE SOLO SE canEdit */}
            {canEdit && (
              <button
                onClick={openNewOrderForm}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4" />
                Crea Primo Ordine
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            {ordiniMateriali.map((ordine) => {
              const oggi = new Date();
              const statoOrdine = (ordine.stato || 'ordinato') as string;
              const isAnnullato = statoOrdine === 'annullato';
              const isArrivato = statoOrdine === 'consegnato';
              const isSbagliato = statoOrdine === 'sbagliato';
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
              const statoDisponibilita = (ordine.stato_disponibilita || 'disponibile') as typeof DISPONIBILITA_STATES[number];
              const disponibilitaBadge = DISPONIBILITA_BADGE[statoDisponibilita];
              const promemoriaDisponibilitaDate = parseDateSafe(ordine.promemoria_disponibilita);
              let promemoriaFormattato: string | null = null;
              let promemoriaScaduto = false;
              if (promemoriaDisponibilitaDate) {
                promemoriaFormattato = promemoriaDisponibilitaDate.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                promemoriaScaduto = promemoriaDisponibilitaDate.getTime() <= Date.now();
              }
              const hasOpenAction = Boolean(ordine.needs_action && !ordine.needs_action_done);
              const actionType = (ordine.needs_action_type || 'OTHER') as NeedsActionType;
              const actionDueDate = formatDateForInput(ordine.needs_action_due_date);

              let nomeFornitore = 'Non specificato';
              if (ordine.fornitori_lenti?.nome) nomeFornitore = ordine.fornitori_lenti.nome;
              else if (ordine.fornitori_lac?.nome) nomeFornitore = ordine.fornitori_lac.nome;
              else if (ordine.fornitori_montature?.nome) nomeFornitore = ordine.fornitori_montature.nome;
              else if (ordine.fornitori_lab_esterno?.nome) nomeFornitore = ordine.fornitori_lab_esterno.nome;
              else if (ordine.fornitori_sport?.nome) nomeFornitore = ordine.fornitori_sport.nome;
              const nomeClassificazione = ordine.classificazione_lenti?.nome
                || (ordine.classificazione_lenti_id
                  ? classificazioneLenti.find(c => c.id === ordine.classificazione_lenti_id)?.nome || null
                  : null);

              const cardBaseClasses = isAnnullato
                ? 'border-slate-200 bg-slate-50/80 text-slate-500 cursor-not-allowed'
                : isSbagliato
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-md';
              const chipsContainerClass = isAnnullato
                ? 'border-slate-200 bg-slate-100/70'
                : isSbagliato
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-slate-50';
              const infoPanelClass = isAnnullato
                ? 'border-slate-200 bg-slate-100/60'
                : isSbagliato
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-slate-100 bg-white';
              const titoloOrdineClass = isAnnullato || isSbagliato
                ? 'text-lg font-medium text-slate-500'
                : 'text-lg font-semibold text-slate-900';
              const infoRowTextClass = isAnnullato || isSbagliato ? 'text-slate-500' : 'text-slate-600';

              const statoBadgeLabelMap: Record<string, string> = {
                da_ordinare: 'DA ORDINARE',
                ordinato: 'ORDINATO',
                in_arrivo: 'IN ARRIVO',
                in_ritardo: 'IN RITARDO',
                consegnato: 'ARRIVATO',
                accettato_con_riserva: 'CON RISERVA',
                rifiutato: 'RIFIUTATO',
                annullato: 'ANNULLATO',
                sbagliato: 'SBAGLIATO'
              };
              const statoBadgeLabel = statoBadgeLabelMap[statoOrdine] ?? statoOrdine.replace(/_/g, ' ').toUpperCase();
              const statoBadgeClass = statoOrdine === 'consegnato'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : statoOrdine === 'in_arrivo'
                  ? 'bg-sky-100 text-sky-800 border-sky-200'
                  : statoOrdine === 'in_ritardo'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : statoOrdine === 'ordinato'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : statoOrdine === 'da_ordinare'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : statoOrdine === 'rifiutato'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : statoOrdine === 'annullato'
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : statoOrdine === 'sbagliato'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-orange-100 text-orange-800 border-orange-200';
              const showGreenOrderStatus = ['da_ordinare', 'ordinato'].includes(statoOrdine);

              return (
                <div key={ordine.id} className={`group rounded-xl border shadow-sm transition-shadow ${cardBaseClasses}`}>
                  <div className="flex flex-col lg:flex-row">
                    <div className="flex-1 p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        {/* ✅ EDITABLE DESCRIPTION */}
                        {editingDescriptionId === ordine.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingDescriptionValue}
                              onChange={(e) => setEditingDescriptionValue(e.target.value)}
                              className="flex-1 px-3 py-1 text-sm font-semibold border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveDescription(ordine.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditingDescription();
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveDescription(ordine.id)}
                              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                              title="Salva"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEditingDescription}
                              className="p-1 text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded"
                              title="Annulla"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className={titoloOrdineClass}>
                              {ordine.descrizione_prodotto}
                            </h4>
                            {canEdit && !isAnnullato && (
                              <button
                                onClick={() => handleStartEditingDescription(ordine.id, ordine.descrizione_prodotto)}
                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-300 hover:border-blue-400"
                                title="Modifica descrizione"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${chipsContainerClass}`}>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full border ${disponibilitaBadge.className}`}
                          title="Stato disponibilità presso il fornitore"
                        >
                          {disponibilitaBadge.label}
                        </span>

                        {hasOpenAction && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (!canEdit) return;
                                setActionMenuId(prev => prev === ordine.id ? null : ordine.id);
                              }}
                              disabled={!canEdit}
                              className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                                canEdit
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                              }`}
                              title={`Azione richiesta non completata${actionDueDate ? `. Scadenza: ${actionDueDate}` : ''}. Clicca per aggiornare.`}
                            >
                              {ACTION_CHIP_LABELS[actionType]}
                            </button>
                            {canEdit && actionMenuId === ordine.id && (
                              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                <button
                                  type="button"
                                  onClick={() => handleCompleteAction(ordine.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                >
                                  Segna come completata
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuId(null);
                                    handleStartEditingNote(ordine.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                >
                                  Aggiungi nota
                                </button>
                                <div className="px-3 py-2 border-t border-gray-100">
                                  <label className="block text-[11px] text-gray-500 mb-1">
                                    Imposta scadenza
                                  </label>
                                  <input
                                    type="date"
                                    value={actionDueDate}
                                    onChange={(e) => handleUpdateActionDueDate(ordine.id, e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-gray-200"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* ✅ MODIFICA: Toggle da_ordinare - NASCOSTO PER OPERATORI */}
                        {showGreenOrderStatus && canEdit && !isAnnullato && (
                          <button
                            onClick={() => handleToggleDaOrdinare(ordine.id, daOrdinare)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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
                        {showGreenOrderStatus && !canEdit && !isAnnullato && (
                          <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
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

                        {giorniRitardo > 0 && !isArrivato && (
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                              giorniRitardo > 2
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                            title={`${giorniRitardo} giorno${giorniRitardo > 1 ? 'i' : ''} di ritardo`}
                          >
                            Ritardo {giorniRitardo}g
                          </span>
                        )}

                        {!showGreenOrderStatus && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statoBadgeClass}`}>
                            {statoBadgeLabel}
                          </span>
                        )}
                      </div>

                      <div className={`mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border p-4 text-sm ${infoPanelClass} ${infoRowTextClass}`}>
                        {ordine.tipi_lenti?.nome && (
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-slate-400" />
                            <span>
                              <strong>Tipo lenti:</strong> {ordine.tipi_lenti.nome}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Factory className="w-4 h-4 text-slate-400" />
                          <span>
                            <strong>Fornitore:</strong> {nomeFornitore}
                          </span>
                        </div>

                        {nomeClassificazione && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span>
                              <strong>Classificazione:</strong> {nomeClassificazione}
                            </span>
                          </div>
                        )}

                        {ordine.trattamenti && ordine.trattamenti.length > 0 && (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                            <div>
                              <strong>Trattamenti:</strong>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ordine.trattamenti.map(t => (
                                  <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                    {getTreatmentLabel(t)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span>
                            <strong>Come ordinare:</strong> {ordine.tipi_ordine?.nome || 'Non specificato'}
                          </span>
                        </div>

                        {ordine.data_ordine && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>
                              <strong>Ordinato:</strong> {new Date(ordine.data_ordine).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}
                        
                        {ordine.data_consegna_prevista && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>
                              <strong>Previsto:</strong> {new Date(ordine.data_consegna_prevista).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}

                        {ordine.data_consegna_effettiva && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span>
                              <strong>Arrivato:</strong> {new Date(ordine.data_consegna_effettiva).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        )}

                        {giorniRitardo > 0 && !isArrivato && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-4 h-4 ${giorniRitardo > 2 ? 'text-red-500' : 'text-amber-500'}`} />
                            <span className={giorniRitardo > 2 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                              {giorniRitardo} giorni di ritardo
                            </span>
                          </div>
                        )}
                        {promemoriaFormattato && (
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${promemoriaScaduto ? 'text-red-500' : 'text-slate-400'}`} />
                            <span className={`text-xs ${promemoriaScaduto ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                              Promemoria disponibilità: {promemoriaFormattato}
                            </span>
                          </div>
                        )}
                      </div>

                      {ordine.note && (
                        <div className={`mt-4 rounded-lg border p-3 ${isAnnullato ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-sm whitespace-pre-line ${isAnnullato ? 'text-slate-500' : 'text-slate-700'}`}>
                            <strong>Note:</strong> {ordine.note}
                          </p>
                        </div>
                      )}

                      {editingNoteId === ordine.id && (
                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                          <label className="block text-xs font-semibold text-blue-900 mb-2">
                            Aggiungi nota
                          </label>
                          <textarea
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Scrivi una nota breve da aggiungere alla storia..."
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={handleCancelEditingNote}
                              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                            >
                              Annulla
                            </button>
                            <button
                              onClick={() => handleSaveNote(ordine.id)}
                              disabled={isSavingNote}
                              className="px-3 py-1.5 text-xs text-white bg-[var(--ink)] rounded hover:bg-black disabled:opacity-50"
                            >
                              {isSavingNote ? 'Salvataggio...' : 'Salva nota'}
                            </button>
                          </div>
                        </div>
                      )}

                      {isSbagliato && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm text-amber-800">
                            ⚠️ La bozza dell&apos;errore è stata creata. Contatta un amministratore per completarla.
                          </p>
                        </div>
                      )}

                      {canEditOrder && editingOrderId === ordine.id && (
                        <div className="mt-6">
                          {renderOrderForm('Modifica Ordine Materiale', resetOrderForm, handleSaveEditedOrder)}
                        </div>
                      )}
                    </div>

                    {/* ✅ MODIFICA: AZIONI - NASCOSTE PER OPERATORI */}
                    {canEdit && (
                      <div className={`w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 ${isAnnullato ? 'bg-slate-100/60' : 'bg-slate-50/80'}`}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Azioni
                        </div>
                        <div className="mt-3 flex flex-col gap-3">
                          <button
                            onClick={() => openEventModal(ordine.id)}
                            disabled={isAnnullato}
                            className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              isAnnullato
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Registra un imprevisto (fornitore/cliente) e crea un promemoria se necessario."
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span>Segnala evento</span>
                          </button>
                          <button
                            onClick={() => handleStartEditingNote(ordine.id)}
                            className="w-full px-3 py-2 text-xs text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                            title="Aggiungi nota ordine"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Aggiungi nota</span>
                          </button>
                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Disponibilità fornitore
                            </label>
                            <select
                              value={statoDisponibilita}
                              onChange={(e) => handleAggiornaDisponibilita(ordine.id, e.target.value as typeof DISPONIBILITA_STATES[number])}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-blue-500"
                              disabled={isAnnullato}
                              title="Disponibilità presso il fornitore"
                            >
                              {DISPONIBILITA_STATES.map(opzione => (
                                <option key={opzione} value={opzione}>
                                  {DISPONIBILITA_BADGE[opzione].label}
                                </option>
                              ))}
                            </select>
                            <div className="text-[10px] text-slate-400 mt-1">
                              Usa queste opzioni solo se comunicate dal fornitore.
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Promemoria disponibilità
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-blue-500"
                                value={formatDateForInput(ordine.promemoria_disponibilita)}
                                onChange={(e) => handleAggiornaPromemoriaDisponibilita(ordine.id, e.target.value)}
                                disabled={isAnnullato || statoDisponibilita === 'disponibile'}
                                title="Promemoria per ricontrollare la disponibilità"
                              />
                              {ordine.promemoria_disponibilita && (
                                <button
                                  type="button"
                                  onClick={() => handleAggiornaPromemoriaDisponibilita(ordine.id, '')}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                  title="Rimuovi promemoria"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Stato ordine
                            </label>
                            <select
                              value={statoOrdine}
                              onChange={(e) => handleAggiornaStatoOrdine(ordine.id, e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-blue-500"
                              disabled={isAnnullato}
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
                              <option value="consegnato">✅ Arrivato</option>
                              <option value="accettato_con_riserva">🔄 Con Riserva</option>
                              <option value="rifiutato">❌ Rifiutato</option>
                              <option value="sbagliato">⚠️ Sbagliato</option>
                            </select>
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActionsMenuId(prev => prev === ordine.id ? null : ordine.id)}
                              className="w-full px-3 py-2 text-xs text-slate-700 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2"
                            >
                              <MoreVertical className="w-4 h-4" />
                              <span>Azioni</span>
                            </button>
                            {actionsMenuId === ordine.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                {canEditOrder && !isAnnullato && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      handleStartEditingOrder(ordine);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                  >
                                    Modifica ordine
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsMenuId(null);
                                    handleDuplicateOrder(ordine);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                                >
                                  Duplica ordine
                                </button>
                                {!isAnnullato && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      setCancelOrderId(ordine.id);
                                      setCancelReason('');
                                      setCancelNote('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-orange-700 hover:bg-orange-50"
                                  >
                                    Annulla ordine
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      handleDeleteOrdine(ordine.id);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Elimina definitivamente
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
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
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-semibold text-slate-900">Riepilogo</h3>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Totale ordini</div>
              <div className="text-2xl font-semibold text-blue-600">
                {ordiniMateriali.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Da ordinare</div>
              <div className="text-2xl font-semibold text-orange-600">
                {ordiniMateriali.filter(o => (o.da_ordinare ?? true) === true).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Arrivati</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {ordiniMateriali.filter(o => (o.stato || 'ordinato') === 'consegnato').length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">In ritardo</div>
              <div className="text-2xl font-semibold text-red-600">
                {ordiniMateriali.filter(o => (o.stato || 'ordinato') === 'in_ritardo').length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Disponibili</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {disponibilitaStats.counts.disponibile}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Riassortimento</div>
              <div className="text-2xl font-semibold text-amber-600">
                {disponibilitaStats.counts.riassortimento}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Esauriti</div>
              <div className="text-2xl font-semibold text-rose-600">
                {disponibilitaStats.counts.esaurito}
              </div>
            </div>
            {disponibilitaReminderLabel && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Prossimo controllo</div>
                <div className={`text-base font-semibold ${promemoriaDisponibilitaScaduto ? 'text-red-600' : 'text-slate-700'}`}>
                  {disponibilitaReminderLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {eventOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Segnala evento ordine</h3>
                <p className="text-sm text-gray-500">
                  Registra cosa è successo e, se serve, crea un promemoria.
                </p>
              </div>
              <button
                onClick={closeEventModal}
                className="text-gray-400 hover:text-gray-600"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo evento (obbligatorio)
                </label>
                <select
                  value={eventForm.type}
                  onChange={(e) => handleEventTypeChange(e.target.value as EventType | '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona...</option>
                  {EVENT_TYPES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {eventErrors.type && (
                  <p className="text-xs text-red-600 mt-1">{eventErrors.type}</p>
                )}
              </div>

              {/* ✅ Campo colpa - visibile solo per prodotto_errato */}
              {eventForm.type === 'prodotto_errato' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-amber-800 mb-2">
                    ⚠️ Di chi è la colpa? (obbligatorio)
                  </label>
                  <select
                    value={eventForm.colpaErrore}
                    onChange={(e) => setEventForm(prev => ({
                      ...prev,
                      colpaErrore: e.target.value as '' | 'errore_interno' | 'errore_cliente' | 'errore_fornitore'
                    }))}
                    className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">Seleziona...</option>
                    <option value="errore_interno">🏪 Errore interno (nostro) - Abbiamo ordinato sbagliato</option>
                    <option value="errore_cliente">👤 Errore cliente - Il cliente ha comunicato dati errati</option>
                    <option value="errore_fornitore">🏭 Errore fornitore - Hanno inviato prodotto diverso</option>
                  </select>
                  {eventErrors.colpa && (
                    <p className="text-xs text-red-600 mt-1">{eventErrors.colpa}</p>
                  )}
                  <p className="text-xs text-amber-700 mt-2">
                    L'ordine verrà marcato come SBAGLIATO e rimarrà come storico.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cosa è successo? (obbligatorio)
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. Fornitore sposta consegna a venerdì / montatura non disponibile / serve prova cliente..."
                />
                {eventErrors.description && (
                  <p className="text-xs text-red-600 mt-1">{eventErrors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Azione richiesta
                </label>
                <select
                  value={eventForm.actionRequired}
                  onChange={(e) => setEventForm(prev => ({ ...prev, actionRequired: e.target.value as ActionRequiredValue }))}
                  disabled={eventForm.type === 'serve_cliente'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  {ACTION_REQUIRED_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Se scegli un'azione, Kiasma crea un promemoria.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scadenza promemoria (opzionale)
                </label>
                <input
                  type="date"
                  value={eventForm.dueDate}
                  onChange={(e) => setEventForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  disabled={eventForm.actionRequired === 'none' && eventForm.type !== 'serve_cliente'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={eventForm.actionDoneNow}
                  onChange={(e) => setEventForm(prev => ({ ...prev, actionDoneNow: e.target.checked }))}
                  disabled={eventForm.actionRequired === 'none' && eventForm.type !== 'serve_cliente'}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Azione fatta ora (chiudi promemoria)
              </label>
              <p className="text-xs text-gray-500">
                Spunta solo se hai già contattato o gestito l'azione.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
              <button
                onClick={closeEventModal}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEvent}
                className="px-3 py-2 text-sm text-white bg-[var(--ink)] hover:bg-black rounded"
              >
                Salva evento
              </button>
            </div>
          </div>
        </div>
      )}

      {availabilityPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Promemoria cliente</h3>
              <p className="text-sm text-gray-600 mt-1">
                Il fornitore ha indicato {availabilityPrompt.stato === 'riassortimento' ? 'RIASSORTIMENTO' : 'ESAURITO'}. Vuoi segnare il cliente come contattato subito?
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-3">
              <button
                onClick={() => handleAvailabilityPromptChoice(false)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                title="Resterà un promemoria aperto sulla busta."
              >
                No, più tardi
              </button>
              <button
                onClick={() => handleAvailabilityPromptChoice(true)}
                className="px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
              >
                Sì, contattato ora
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">🗑️ Annulla ordine</h3>
              <p className="text-sm text-gray-600 mt-1">
                L'ordine verrà impostato come ANNULLATO e non verrà eliminato.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* ⚠️ Warning archiviazione */}
              {cancelWillArchive && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ ATTENZIONE: Questo è l'unico ordine attivo.
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Annullandolo, la busta verrà <strong>archiviata automaticamente</strong>.
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Se devi rifare l'ordine, inserisci prima il nuovo ordine e poi annulla questo.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo annullo (obbligatorio)
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="Cliente rinuncia">Cliente rinuncia</option>
                  <option value="Fornitore non disponibile">Fornitore non disponibile</option>
                  <option value="Sostituito con alternativa">Sostituito con alternativa</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              {/* 💡 Suggerimento se seleziona motivo che suggerisce "sbagliato" */}
              {cancelReason === 'Sostituito con alternativa' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>💡 Suggerimento:</strong> Se il prodotto è arrivato ma era sbagliato,
                    considera di usare lo stato "Sbagliato" invece di annullare.
                    Così l'ordine rimane come storico e puoi tracciare l'errore.
                  </p>
                </div>
              )}

              {cancelReason === 'Altro' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nota (obbligatoria se "Altro")
                  </label>
                  <textarea
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Scrivi cosa è successo..."
                  />
                </div>
              )}

              {/* 💡 Suggerimento workflow se busta in lavorazione/pronto */}
              {(workflowStatus === 'in_lavorazione' || workflowStatus === 'pronto_ritiro') && !cancelWillArchive && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Nota:</strong> Dopo l'annullamento, ricorda che puoi
                    trascinare la busta nella colonna "Mat. Ordinati" dalla dashboard
                    Kanban se devi riordinare.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => {
                  setCancelOrderId(null);
                  setCancelReason('');
                  setCancelNote('');
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmCancelOrder}
                disabled={isCancellingOrder}
                className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-60"
              >
                {isCancellingOrder ? 'Annullamento...' : 'Conferma annullo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSospesaFollowupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Esito follow-up busta sospesa</h3>
              <p className="text-sm text-gray-600 mt-1">
                Registra l'esito del follow-up. Non è previsto un secondo follow-up automatico.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Esito (obbligatorio)
                </label>
                <select
                  value={sospesaFollowupReason}
                  onChange={(e) => setSospesaFollowupReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="Cliente irreperibile">Cliente irreperibile</option>
                  <option value="Cliente non convinto">Cliente non convinto</option>
                  <option value="Prezzo eccessivo">Prezzo eccessivo</option>
                  <option value="Prodotto non convince">Prodotto non convince</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nota (obbligatoria)
                </label>
                <textarea
                  value={sospesaFollowupNote}
                  onChange={(e) => setSospesaFollowupNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. cliente vuole ripassare per alternativa / conferma che non procede / nessuna risposta..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => {
                  setShowSospesaFollowupModal(false);
                  setSospesaFollowupReason('');
                  setSospesaFollowupNote('');
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveSospesaFollowup}
                disabled={isSavingSospesaFollowup}
                className="px-3 py-2 text-sm text-white bg-[var(--ink)] hover:bg-black rounded disabled:opacity-60"
              >
                {isSavingSospesaFollowup ? 'Salvataggio...' : 'Salva esito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
