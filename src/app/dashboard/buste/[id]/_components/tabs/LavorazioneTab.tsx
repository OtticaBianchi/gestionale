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
  Check,
  CheckCircle,
  CheckSquare,
  Calendar,
  Truck,
  AlertCircle,
  Loader2,
  Settings,
  Phone,
  PhoneCall,
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
  scheduled_pickup?: string | null;
  scheduled_return?: string | null;
  actual_pickup?: string | null;
  actual_return?: string | null;
  // Joined data
  tipi_montaggio?: { nome: string } | null;
  profiles?: { full_name: string } | null;
  checklist_items?: LavorazioneChecklistItem[] | null;
};

type TipoMontaggio = Database['public']['Tables']['tipi_montaggio']['Row'];
type LavorazioneChecklistItem = Database['public']['Tables']['lavorazioni_checklist_items']['Row'];
type ControlloQualita = Database['public']['Tables']['buste_controlli_qualita']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
};
type Comunicazione = Database['public']['Tables']['comunicazioni']['Row'];
type ComunicazioneTipo = 'nota_comunicazione_cliente';
type ActivityKey =
  | 'sagomatura_montaggio'
  | 'lab_esterno'
  | 'controllo_qualita_pre_consegna'
  | 'richiamo_verifica_tecnica'
  | 'verifica_non_adattamento'
  | 'gestione_assistenza_garanzia'
  | 'riparazione_minuteria'
  | 'pit_stop_occhiale'
  | 'training_applicazione_lac'
  | 'pulizia';

const normalizeLabel = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getActivityKeyFromLabel = (label?: string | null): ActivityKey | null => {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;
  if (
    normalized.includes('lab esterno') ||
    normalized.includes('laboratorio esterno') ||
    normalized.startsWith('lab est') ||
    normalized.includes(' lab est ')
  ) {
    return 'lab_esterno';
  }
  if (normalized.includes('lab interno') || normalized.startsWith('lab int') || normalized.includes(' lab int ')) {
    return 'sagomatura_montaggio';
  }
  if (normalized.includes('controllo qualita') && normalized.includes('pre consegna')) {
    return 'controllo_qualita_pre_consegna';
  }
  if (normalized.includes('controllo qualita')) return 'controllo_qualita_pre_consegna';
  if (normalized.includes('pit stop')) return 'pit_stop_occhiale';
  if (normalized.includes('training') && normalized.includes('lac')) return 'training_applicazione_lac';
  if (normalized.includes('applicazione') && normalized.includes('lac')) return 'training_applicazione_lac';
  if (normalized.includes('pulizia')) return 'pulizia';
  if (normalized.includes('sagomatura') || normalized.includes('sagom') || normalized.includes('montaggio')) {
    return 'sagomatura_montaggio';
  }
  if (normalized.includes('riparazione') || normalized.includes('minuteria')) return 'riparazione_minuteria';
  if (normalized.includes('richiamo') && normalized.includes('verifica')) return 'richiamo_verifica_tecnica';
  if (normalized.includes('non adattamento')) return 'verifica_non_adattamento';
  if (normalized.includes('assistenza') || normalized.includes('garanzia')) return 'gestione_assistenza_garanzia';
  return null;
};

// Matrice attività consentite per categoria busta (per chiave)
const ACTIVITY_MATRIX: Record<string, ActivityKey[]> = {
  VISTA: [
    'sagomatura_montaggio',
    'lab_esterno',
    'controllo_qualita_pre_consegna',
    'richiamo_verifica_tecnica',
    'verifica_non_adattamento',
    'gestione_assistenza_garanzia'
  ],
  SOLE: [
    'sagomatura_montaggio',
    'controllo_qualita_pre_consegna',
    'gestione_assistenza_garanzia',
    'lab_esterno',
    'richiamo_verifica_tecnica',
    'verifica_non_adattamento'
  ],
  LAC: ['training_applicazione_lac', 'pulizia', 'richiamo_verifica_tecnica', 'gestione_assistenza_garanzia'],
  RIPARAZIONE: ['riparazione_minuteria', 'lab_esterno', 'controllo_qualita_pre_consegna'],
  LABORATORIO: [
    'sagomatura_montaggio',
    'lab_esterno',
    'controllo_qualita_pre_consegna',
    'richiamo_verifica_tecnica',
    'riparazione_minuteria',
    'pit_stop_occhiale'
  ]
};

const CHECKLISTS: Partial<Record<ActivityKey, string[]>> = {
  sagomatura_montaggio: [
    'Parametri ordine verificati (RX/PD/altezza/trattamenti)',
    'Sagoma montatura tracciata e centratura corretta',
    'Sagomatura e montaggio completati senza difetti',
    'Assetto meccanico ok (aste/chiusure/allineamento)',
    'Pulizia finale lenti e montatura',
    'Note/anomalie registrate (se presenti)'
  ],
  controllo_qualita_pre_consegna: [
    'Pulizia lenti (no aloni)',
    'Assetto aste (in piano)',
    'Serraggio viti/chiusura cerchi',
    'Verifica corrispondenza lenti/ordine',
    'Dotazione (Astuccio + Microfibra)',
    'Pulizia completa occhiali'
  ],
  pit_stop_occhiale: [
    'Lavaggio ultrasuoni',
    'Sostituzione naselli (se nec.)',
    'Serraggio viteria completa',
    'Riadattamento assetto'
  ],
  training_applicazione_lac: [
    'Igiene mani verificata',
    'Applicazione OD riuscita',
    'Applicazione OS riuscita',
    'Rimozione OD riuscita',
    'Rimozione OS riuscita',
    'Istruzioni manutenzione fornite'
  ]
};

const getCategoryForBusta = (tipoLavorazione?: string | null): string => {
  if (!tipoLavorazione) return 'VISTA';
  if (['OCV', 'OV', 'LV', 'SG', 'VC'].includes(tipoLavorazione)) return 'VISTA';
  if (['OS', 'LS', 'ACC', 'BR'].includes(tipoLavorazione)) return 'SOLE';
  if (['LAC', 'TALAC'].includes(tipoLavorazione)) return 'LAC';
  if (['LAB'].includes(tipoLavorazione)) return 'LABORATORIO';
  if (['RIC', 'SA'].includes(tipoLavorazione)) return 'RIPARAZIONE';
  return 'VISTA';
};

interface LavorazioneTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean;
  onBustaUpdate?: (updatedBusta: BustaDettagliata) => void;
}

export default function LavorazioneTab({ busta, isReadOnly = false, onBustaUpdate }: LavorazioneTabProps) {
  const formatTimestamp = (value: Date = new Date()) => {
    const pad = (input: number) => String(input).padStart(2, '0');
    const year = value.getFullYear();
    const month = pad(value.getMonth() + 1);
    const day = pad(value.getDate());
    const hours = pad(value.getHours());
    const minutes = pad(value.getMinutes());
    return `${day}:${month}:${year} ${hours}:${minutes}`;
  };

  // ===== STATE =====
  const [lavorazioni, setLavorazioni] = useState<Lavorazione[]>([]);
  const [controlliQualita, setControlliQualita] = useState<ControlloQualita[]>([]);
  const [tipiMontaggio, setTipiMontaggio] = useState<TipoMontaggio[]>([]);
  const [showNuovaLavorazioneForm, setShowNuovaLavorazioneForm] = useState(false);
  const [isLoadingLavorazioni, setIsLoadingLavorazioni] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [controlloCompletato, setControlloCompletato] = useState(false);
  const [isMovingToReady, setIsMovingToReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showCheckboxSection, setShowCheckboxSection] = useState(false);
  const [labEsternoForm, setLabEsternoForm] = useState({
    scheduled_pickup: '',
    scheduled_return: ''
  });
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [richiedeTelefonata, setRichiedeTelefonata] = useState<boolean>(busta.richiede_telefonata || false);
  const [telefonataAssegnataA, setTelefonataAssegnataA] = useState<string>(busta.telefonata_assegnata_a || '');
  const [telefonataCompletata, setTelefonataCompletata] = useState<boolean>(busta.telefonata_completata || false);
  const [telefonataCompletataData, setTelefonataCompletataData] = useState<string | null>(busta.telefonata_completata_data || null);
  const [isSavingPhoneRequest, setIsSavingPhoneRequest] = useState(false);
  const [showingCallOutcome, setShowingCallOutcome] = useState(false);
  const [telefonataMotivo, setTelefonataMotivo] = useState('');
  const [telefonataScheduledAt, setTelefonataScheduledAt] = useState('');

  const PHONE_ASSIGNEES = ['Chiunque', 'Enrico', 'Valentina', 'Marco', 'Roberta', 'Cecilia', 'Anna', 'Monica', 'Noemi'];

  // User context for role checking
  const { profile } = useUser();

  // ✅ AGGIORNATO: Helper per controlli - solo le azioni di modifica sono limitate
  const canEdit = !isReadOnly && profile?.role !== 'operatore';

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCurrentUser(null);
          return;
        }
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setCurrentUser({ id: user.id, full_name: profileData?.full_name || 'Operatore' });
      } catch (error) {
        setCurrentUser(null);
      }
    };

    loadCurrentUser();
  }, []);

  // Initialize checkbox state from database
  useEffect(() => {
    if (busta.controllo_completato) {
      setControlloCompletato(true);
    }
  }, [busta.controllo_completato]);

  useEffect(() => {
    setRichiedeTelefonata(busta.richiede_telefonata || false);
    setTelefonataAssegnataA(busta.telefonata_assegnata_a || '');
    setTelefonataCompletata(busta.telefonata_completata || false);
    setTelefonataCompletataData(busta.telefonata_completata_data || null);
  }, [busta.richiede_telefonata, busta.telefonata_assegnata_a, busta.telefonata_completata, busta.telefonata_completata_data, busta.id]);

  // Update showCheckboxSection based on busta status and lavorazioni
  useEffect(() => {
    // Show if: in lavorazione OR already moved to pronto_ritiro with completed check
    const shouldShow = isMounted && lavorazioni.length > 0 && (
      (canEdit && busta.stato_attuale === 'in_lavorazione') ||
      (busta.stato_attuale === 'pronto_ritiro' && (busta.controllo_completato ?? false))
    );

    setShowCheckboxSection(shouldShow);
  }, [busta.stato_attuale, busta.controllo_completato, lavorazioni.length, isMounted, canEdit]);

  // Form per nuova lavorazione
  const [nuovaLavorazioneForm, setNuovaLavorazioneForm] = useState({
    tipo_montaggio_id: '',
    note: '',
    data_inizio: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!nuovaLavorazioneForm.tipo_montaggio_id || nuovaLavorazioneForm.tipo_montaggio_id === 'nessuna_lavorazione') {
      setLabEsternoForm({ scheduled_pickup: '', scheduled_return: '' });
      return;
    }

    const selectedTipo = tipiMontaggio.find(
      tipo => tipo.id.toString() === nuovaLavorazioneForm.tipo_montaggio_id
    );
    const selectedKey = getActivityKeyFromLabel(selectedTipo?.nome);
    const hasChecklist = selectedKey ? CHECKLISTS[selectedKey] : null;
    const isLabEsterno = selectedKey === 'lab_esterno';

    if (!isLabEsterno) {
      setLabEsternoForm({ scheduled_pickup: '', scheduled_return: '' });
    }
  }, [nuovaLavorazioneForm.tipo_montaggio_id, tipiMontaggio]);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const updateBustaState = (updates: Partial<BustaDettagliata>) => {
    if (onBustaUpdate) {
      onBustaUpdate({ ...busta, ...updates });
    }
  };

  const categoriaBusta = getCategoryForBusta(busta.tipo_lavorazione);
  const allowedActivities = ACTIVITY_MATRIX[categoriaBusta] ?? [];
  const filteredTipiMontaggio = allowedActivities.length > 0
    ? tipiMontaggio.filter((tipo) => {
        if (tipo.nome === 'Nessuna Lavorazione') return false;
        const key = getActivityKeyFromLabel(tipo.nome);
        return key ? allowedActivities.includes(key) : false;
      })
    : tipiMontaggio.filter(tipo => tipo.nome !== 'Nessuna Lavorazione');
  const visibleTipiMontaggio = filteredTipiMontaggio.length > 0
    ? filteredTipiMontaggio
    : tipiMontaggio.filter(tipo => tipo.nome !== 'Nessuna Lavorazione');
  const selectedTipoMontaggio = nuovaLavorazioneForm.tipo_montaggio_id &&
    nuovaLavorazioneForm.tipo_montaggio_id !== 'nessuna_lavorazione'
    ? tipiMontaggio.find(tipo => tipo.id.toString() === nuovaLavorazioneForm.tipo_montaggio_id)
    : null;
  const selectedTipoKey = getActivityKeyFromLabel(selectedTipoMontaggio?.nome);
  const isLabEsternoSelected = selectedTipoKey === 'lab_esterno';
  const allChecklistsCompleted = lavorazioni.length > 0 && lavorazioni.every((lav) => {
    const items = lav.checklist_items || [];
    return items.length === 0 || items.every(item => item.is_checked);
  });
  const allLavorazioniCompleted = lavorazioni.length > 0 && lavorazioni.every(lav => lav.stato === 'completato');
  const phoneRequirementSatisfied = !richiedeTelefonata || telefonataCompletata;
  const controlloPrerequisitesMet = allChecklistsCompleted && allLavorazioniCompleted && phoneRequirementSatisfied;

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
          updated_at,
          scheduled_pickup,
          scheduled_return,
          actual_pickup,
          actual_return
        `)
        .eq('busta_id', busta.id)
        .order('created_at', { ascending: false });

      if (lavorazioniError) {
        console.error('❌ Errore caricamento lavorazioni:', lavorazioniError);
        throw lavorazioniError;
      }

      const checklistItemsByLavorazione = new Map<string, LavorazioneChecklistItem[]>();
      const lavorazioniIds = (lavorazioniData || []).map(lavorazione => lavorazione.id);

      if (lavorazioniIds.length > 0) {
        const { data: checklistData, error: checklistError } = await supabase
          .from('lavorazioni_checklist_items')
          .select('id, lavorazione_id, item_label, is_checked, created_at, updated_at')
          .in('lavorazione_id', lavorazioniIds)
          .order('created_at', { ascending: true });

        if (checklistError) {
          console.error('❌ Errore caricamento checklist lavorazioni:', checklistError);
        } else {
          (checklistData || []).forEach((item) => {
            const existing = checklistItemsByLavorazione.get(item.lavorazione_id) || [];
            existing.push(item);
            checklistItemsByLavorazione.set(item.lavorazione_id, existing);
          });
        }
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
            profiles: { full_name: responsabileNome },
            checklist_items: checklistItemsByLavorazione.get(lavorazione.id) || []
          } as Lavorazione;
        })
      );

      console.log(`✅ Caricate ${lavorazioniArricchite.length} lavorazioni per busta ${busta.id}`);
      setLavorazioni(lavorazioniArricchite);

      const { data: qcData, error: qcError } = await supabase
        .from('buste_controlli_qualita')
        .select('id, busta_id, cycle_index, completed_by, completed_at, created_at, profiles:completed_by(full_name)')
        .eq('busta_id', busta.id)
        .order('cycle_index', { ascending: false });

      if (qcError) {
        console.error('❌ Errore caricamento storico controlli qualità:', qcError);
        setControlliQualita([]);
      } else {
        setControlliQualita((qcData || []) as ControlloQualita[]);
      }
      
    } catch (error) {
      console.error('❌ Error loading lavorazioni data:', error);
      setLavorazioni([]);
      setControlliQualita([]);
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
            updated_at,
            scheduled_pickup,
            scheduled_return,
            actual_pickup,
            actual_return
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
          profiles: { full_name: responsabileNome },
          checklist_items: []
        };

        setLavorazioni(prev => [lavorazioneArricchita, ...prev]);

        setNuovaLavorazioneForm({
          tipo_montaggio_id: '',
          note: '',
          data_inizio: new Date().toISOString().split('T')[0]
        });
        setLabEsternoForm({ scheduled_pickup: '', scheduled_return: '' });

        setShowNuovaLavorazioneForm(false);
        alert('✅ "Nessuna Lavorazione" registrata. Ora completa il controllo per procedere.');
        return;
      }

      const tentativiEsistenti = lavorazioni.filter(l =>
        l.tipo_montaggio_id?.toString() === nuovaLavorazioneForm.tipo_montaggio_id
      ).length;
      const selectedTipo = tipiMontaggio.find(
        tm => tm.id.toString() === nuovaLavorazioneForm.tipo_montaggio_id
      );
      const selectedKey = getActivityKeyFromLabel(selectedTipo?.nome);
      const isLabEsterno = selectedKey === 'lab_esterno';
      const checklist = selectedKey ? CHECKLISTS[selectedKey] : null;

      const { data: lavorazioneCreata, error } = await supabase
        .from('lavorazioni')
        .insert({
          busta_id: busta.id,
          tipo_montaggio_id: Number.parseInt(nuovaLavorazioneForm.tipo_montaggio_id),
          stato: 'in_corso',
          data_inizio: nuovaLavorazioneForm.data_inizio,
          responsabile_id: user.id,
          tentativo: tentativiEsistenti + 1,
          note: nuovaLavorazioneForm.note.trim() || null,
          scheduled_pickup: isLabEsterno ? labEsternoForm.scheduled_pickup || null : null,
          scheduled_return: isLabEsterno ? labEsternoForm.scheduled_return || null : null,
          actual_pickup: null,
          actual_return: null
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
          updated_at,
          scheduled_pickup,
          scheduled_return,
          actual_pickup,
          actual_return
        `)
        .single();

      if (error) throw error;

      const tipoMontaggioNome = selectedTipo?.nome || 'Sconosciuto';
      let checklistItemsForState: LavorazioneChecklistItem[] | null = null;

      if (checklist) {
        const checklistPayload = checklist.map(item => ({
          lavorazione_id: lavorazioneCreata.id,
          item_label: item,
          is_checked: false
        }));

        const { data: checklistData, error: checklistError } = await supabase
          .from('lavorazioni_checklist_items')
          .insert(checklistPayload)
          .select('id, lavorazione_id, item_label, is_checked, created_at, updated_at');

        if (checklistError) {
          console.error('❌ Errore salvataggio checklist:', checklistError);
          alert('Lavorazione salvata, ma checklist non registrata.');
        } else {
          checklistItemsForState = checklistData || [];
        }
      }
      
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
        profiles: { full_name: responsabileNome },
        checklist_items: checklistItemsForState || []
      };

      setLavorazioni(prev => [lavorazioneArricchita, ...prev]);

      setNuovaLavorazioneForm({
        tipo_montaggio_id: '',
        note: '',
        data_inizio: new Date().toISOString().split('T')[0]
      });
      setLabEsternoForm({ scheduled_pickup: '', scheduled_return: '' });
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
      const trimmedNote = noteAggiuntive.trim();
      const lavorazioneCorrente = lavorazioni.find(lav => lav.id === lavorazioneId);
      const noteEsistenti = lavorazioneCorrente?.note?.trim() || '';
      const esitoLabel = nuovoStato === 'completato' ? 'COMPLETATA' : 'FALLITA';
      const noteLine = trimmedNote ? `${formatTimestamp()} - ${esitoLabel}: ${trimmedNote}` : '';
      const noteAggiornate = noteLine
        ? (noteEsistenti ? `${noteEsistenti}\n\n${noteLine}` : noteLine)
        : (noteEsistenti || null);
      const updateData: any = {
        stato: nuovoStato,
        note: noteAggiornate
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
              note: noteAggiornate,
              updated_at: new Date().toISOString()
            }
          : lav
      ));

    } catch (error: any) {
      console.error('❌ Error updating lavorazione:', error);
      alert(`Errore aggiornamento: ${error.message}`);
    }
  };

  const handleToggleChecklistItem = async (lavorazioneId: string, itemId: string, checked: boolean) => {
    try {
      const { error } = await supabase
        .from('lavorazioni_checklist_items')
        .update({ is_checked: checked })
        .eq('id', itemId);

      if (error) throw error;

      setLavorazioni(prev => prev.map((lav) => {
        if (lav.id !== lavorazioneId) return lav;
        const updatedItems = (lav.checklist_items || []).map(item =>
          item.id === itemId ? { ...item, is_checked: checked, updated_at: new Date().toISOString() } : item
        );
        return { ...lav, checklist_items: updatedItems };
      }));
    } catch (error: any) {
      console.error('❌ Error updating checklist item:', error);
      alert(`Errore aggiornamento checklist: ${error.message}`);
    }
  };

  const updateLatestTechnicalFollowUp = async (patch: Record<string, any>) => {
    try {
      const { data: calls, error } = await supabase
        .from('follow_up_chiamate')
        .select('id, stato_chiamata')
        .eq('busta_id', busta.id)
        .eq('origine', 'tecnico')
        .not('stato_chiamata', 'in', '(chiamato_completato,non_vuole_essere_contattato,numero_sbagliato)')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Errore ricerca follow-up tecnico:', error);
        return;
      }

      const target = (calls || [])[0];
      if (!target) return;

      const { error: updateError } = await supabase
        .from('follow_up_chiamate')
        .update(patch)
        .eq('id', target.id);

      if (updateError) {
        console.error('Errore aggiornamento follow-up tecnico:', updateError);
      }
    } catch (err) {
      console.error('Errore aggiornamento follow-up tecnico:', err);
    }
  };

  const createCommunicationRecord = async (tipo: ComunicazioneTipo, testoFinale: string) => {
    const response = await fetch('/api/comunicazioni', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bustaId: busta.id,
        tipoMessaggio: tipo,
        testoMessaggio: testoFinale,
        destinatarioTipo: 'cliente',
        destinatarioNome: busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : '',
        destinatarioContatto: busta.clienti?.telefono ?? '',
        canaleInvio: 'telefono',
        statoInvio: 'inviato'
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || 'Errore durante la registrazione della comunicazione.');
    }

    return payload?.comunicazione as Comunicazione;
  };

  const handleSavePhoneRequest = async (contextNote?: string | null) => {
    if (!telefonataAssegnataA) {
      alert('Seleziona a chi assegnare la telefonata');
      return;
    }

    setIsSavingPhoneRequest(true);
    try {
      const trimmedMotivo = telefonataMotivo.trim();
      const motivoFinale = trimmedMotivo || (contextNote?.trim() || '');
      const scheduledAt = telefonataScheduledAt ? new Date(telefonataScheduledAt).toISOString() : null;

      const { data: existingTechCalls, error: existingTechError } = await supabase
        .from('follow_up_chiamate')
        .select('id, stato_chiamata')
        .eq('busta_id', busta.id)
        .eq('origine', 'tecnico')
        .not('stato_chiamata', 'in', '(chiamato_completato,non_vuole_essere_contattato,numero_sbagliato)')
        .limit(1);

      if (existingTechError) {
        console.error('Errore controllo follow-up tecnico:', existingTechError);
      }

      if (!existingTechError && (existingTechCalls || []).length === 0) {
        const { error: followUpError } = await supabase
          .from('follow_up_chiamate')
          .insert({
            busta_id: busta.id,
            data_generazione: new Date().toISOString().split('T')[0],
            priorita: 'alta',
            stato_chiamata: 'da_chiamare',
            origine: 'tecnico',
            motivo_urgenza: motivoFinale || null,
            scheduled_at: scheduledAt
          });

        if (followUpError) {
          console.error('Errore creazione follow-up tecnico:', followUpError);
          alert('Errore creazione follow-up tecnico. Riprova o contatta un amministratore.');
        }
      }

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
      updateBustaState({
        richiede_telefonata: true,
        telefonata_assegnata_a: telefonataAssegnataA,
        telefonata_completata: false,
        telefonata_completata_data: null,
        telefonata_completata_da: null
      });
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
      setShowingCallOutcome(false);
      updateBustaState({
        telefonata_completata: true,
        telefonata_completata_data: completedAt,
        telefonata_completata_da: currentUser?.id || null
      });

      try {
        const callerName = currentUser?.full_name || 'Operatore';
        await createCommunicationRecord(
          'nota_comunicazione_cliente',
          `Telefonata al cliente: andata a buon fine. Effettuata da: ${callerName}.`
        );
        await updateLatestTechnicalFollowUp({
          stato_chiamata: 'chiamato_completato',
          data_chiamata: completedAt,
          data_completamento: completedAt.split('T')[0],
          note_chiamata: `Telefonata al cliente: andata a buon fine. Effettuata da: ${callerName}.`
        });
      } catch (communicationError) {
        console.error('Errore salvataggio comunicazione telefonata:', communicationError);
      }

      alert('Telefonata completata con successo!');
    } catch (error: any) {
      console.error('Errore registrazione telefonata:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
    }
  };

  const handleMarkPhoneCallNoAnswer = async () => {
    setIsSavingPhoneRequest(true);
    try {
      const attemptAt = new Date();
      const formattedDate = attemptAt.toLocaleDateString('it-IT');
      const formattedTime = attemptAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const callerName = currentUser?.full_name || 'Operatore';

      try {
        await createCommunicationRecord(
          'nota_comunicazione_cliente',
          `Telefonata al cliente: nessuna risposta - richiamare. Tentativo effettuato da ${callerName} il ${formattedDate} alle ${formattedTime}.`
        );
        await updateLatestTechnicalFollowUp({
          stato_chiamata: 'richiamami',
          note_chiamata: `Telefonata al cliente: nessuna risposta - richiamare. Tentativo effettuato da ${callerName} il ${formattedDate} alle ${formattedTime}.`
        });
      } catch (communicationError) {
        console.error('Errore salvataggio comunicazione telefonata:', communicationError);
      }

      setShowingCallOutcome(false);
      alert('Tentativo registrato. Il cliente dovrà essere richiamato.');
    } catch (error: any) {
      console.error('Errore registrazione tentativo:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
    }
  };

  const handleCancelPhoneRequest = async () => {
    setIsSavingPhoneRequest(true);
    try {
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

      setRichiedeTelefonata(false);
      setTelefonataAssegnataA('');
      setTelefonataCompletata(false);
      setTelefonataCompletataData(null);
      updateBustaState({
        richiede_telefonata: false,
        telefonata_assegnata_a: null,
        telefonata_completata: false,
        telefonata_completata_data: null,
        telefonata_completata_da: null
      });
      await updateLatestTechnicalFollowUp({
        archiviato: true
      });
      alert('Richiesta telefonata annullata!');
    } catch (error: any) {
      console.error('Errore annullamento richiesta:', error);
      alert(`Errore: ${error.message}`);
    } finally {
      setIsSavingPhoneRequest(false);
    }
  };

  const handleUpdateLabDates = async (
    lavorazioneId: string,
    field: 'actual_pickup' | 'actual_return',
    value: string
  ) => {
    try {
      const { error } = await supabase
        .from('lavorazioni')
        .update({ [field]: value || null })
        .eq('id', lavorazioneId);

      if (error) throw error;

      setLavorazioni(prev => prev.map(lav =>
        lav.id === lavorazioneId
          ? { ...lav, [field]: value || null, updated_at: new Date().toISOString() }
          : lav
      ));
    } catch (error: any) {
      console.error('❌ Error updating lab dates:', error);
      alert(`Errore aggiornamento date lab: ${error.message}`);
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

    if (!controlloPrerequisitesMet) {
      alert('Per completare il controllo finale devi completare tutte le lavorazioni, tutte le checklist ed eventuali telefonate richieste.');
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

      try {
        const { data: lastCycleData, error: cycleError } = await supabase
          .from('buste_controlli_qualita')
          .select('cycle_index')
          .eq('busta_id', busta.id)
          .order('cycle_index', { ascending: false })
          .limit(1);

        if (cycleError) throw cycleError;

        const nextCycle = ((lastCycleData?.[0]?.cycle_index) ?? 0) + 1;

        const { data: qcRow, error: qcInsertError } = await supabase
          .from('buste_controlli_qualita')
          .insert({
            busta_id: busta.id,
            cycle_index: nextCycle,
            completed_by: user.id,
            completed_at: now
          })
          .select('id, busta_id, cycle_index, completed_by, completed_at, created_at')
          .single();

        if (qcInsertError) throw qcInsertError;

        const qcEntry: ControlloQualita = {
          ...(qcRow as ControlloQualita),
          profiles: { full_name: currentUser?.full_name || 'Operatore' }
        };

        setControlliQualita(prev => [qcEntry, ...prev]);
      } catch (qcError) {
        console.error('❌ Errore registrazione storico controllo qualità:', qcError);
        alert('Controllo completato, ma lo storico non è stato registrato. Avvisa un amministratore.');
      }

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
                {visibleTipiMontaggio.map(tipo => (
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

            {isLabEsternoSelected && (
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm mb-3">
                  <Truck className="w-4 h-4" /> Pianificazione Spedizione Lab Esterno
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">Data Ritiro Prevista</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-blue-200 rounded bg-white"
                      value={labEsternoForm.scheduled_pickup}
                      onChange={(e) => setLabEsternoForm(prev => ({ ...prev, scheduled_pickup: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">Data Riconsegna Prevista</label>
                    <input
                      type="date"
                      className="w-full p-2 border border-blue-200 rounded bg-white"
                      value={labEsternoForm.scheduled_return}
                      onChange={(e) => setLabEsternoForm(prev => ({ ...prev, scheduled_return: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2 italic">
                  Le date effettive verranno inserite dopo, dalla scheda dell'attività.
                </p>
              </div>
            )}
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
              const checklistItems = lavorazione.checklist_items || [];
              const checklistComplete = checklistItems.length === 0 || checklistItems.every(item => item.is_checked);
              const canFillChecklist = canEdit && lavorazione.stato === 'in_corso' && (telefonataCompletata || !richiedeTelefonata);

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
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          <strong>Note:</strong> {lavorazione.note}
                        </p>
                      </div>
                    )}

                    {lavorazione.checklist_items && lavorazione.checklist_items.length > 0 && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                        <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold mb-2">
                          <CheckSquare className="w-4 h-4" />
                          Checklist
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {checklistItems.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 text-sm">
                              {canFillChecklist ? (
                                <input
                                  type="checkbox"
                                  checked={item.is_checked}
                                  onChange={(e) => handleToggleChecklistItem(lavorazione.id, item.id, e.target.checked)}
                                  className="w-4 h-4 text-emerald-600 rounded"
                                />
                              ) : (
                                <span className={item.is_checked ? 'text-emerald-600' : 'text-gray-400'}>
                                  {item.is_checked ? '✅' : '⬜'}
                                </span>
                              )}
                              <span className={item.is_checked ? 'text-gray-800' : 'text-gray-500'}>
                                {item.item_label}
                              </span>
                            </label>
                          ))}
                        </div>
                        {!canFillChecklist && checklistItems.length > 0 && (
                          <p className="mt-2 text-xs text-gray-600">
                            La checklist è compilabile dopo il contatto cliente o quando non è richiesta la telefonata.
                          </p>
                        )}
                      </div>
                    )}

                    {getActivityKeyFromLabel(lavorazione.tipi_montaggio?.nome) === 'lab_esterno' && (() => {
                      const pickupDelayed = Boolean(
                        lavorazione.actual_pickup &&
                        lavorazione.scheduled_pickup &&
                        new Date(lavorazione.actual_pickup) > new Date(lavorazione.scheduled_pickup)
                      );
                      const returnDelayed = Boolean(
                        lavorazione.actual_return &&
                        lavorazione.scheduled_return &&
                        new Date(lavorazione.actual_return) > new Date(lavorazione.scheduled_return)
                      );

                      return (
                        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
                          <div className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <Truck className="w-4 h-4" /> Tracking Spedizione
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="block text-xs text-gray-500">Ritiro Previsto</span>
                              <span className="font-medium">
                                {lavorazione.scheduled_pickup
                                  ? new Date(lavorazione.scheduled_pickup).toLocaleDateString('it-IT')
                                  : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-500">Ritiro Effettivo</span>
                              {canEdit && lavorazione.stato === 'in_corso' ? (
                                <input
                                  type="date"
                                  className="w-full p-1 border rounded text-sm"
                                  value={lavorazione.actual_pickup || ''}
                                  onChange={(e) => handleUpdateLabDates(lavorazione.id, 'actual_pickup', e.target.value)}
                                />
                              ) : (
                                <span className="font-medium">
                                  {lavorazione.actual_pickup
                                    ? new Date(lavorazione.actual_pickup).toLocaleDateString('it-IT')
                                    : '-'}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="block text-xs text-gray-500">Rientro Previsto</span>
                              <span className="font-medium">
                                {lavorazione.scheduled_return
                                  ? new Date(lavorazione.scheduled_return).toLocaleDateString('it-IT')
                                  : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-500">Rientro Effettivo</span>
                              {canEdit && lavorazione.stato === 'in_corso' ? (
                                <input
                                  type="date"
                                  className="w-full p-1 border rounded text-sm"
                                  value={lavorazione.actual_return || ''}
                                  onChange={(e) => handleUpdateLabDates(lavorazione.id, 'actual_return', e.target.value)}
                                />
                              ) : (
                                <span className="font-medium">
                                  {lavorazione.actual_return
                                    ? new Date(lavorazione.actual_return).toLocaleDateString('it-IT')
                                    : '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          {(pickupDelayed || returnDelayed) && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              <AlertCircle className="w-4 h-4" /> Attenzione: Ritardo registrato rispetto alla pianificazione.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {(() => {
                      const activityKey = getActivityKeyFromLabel(lavorazione.tipi_montaggio?.nome);
                      if (!['richiamo_verifica_tecnica', 'training_applicazione_lac', 'verifica_non_adattamento'].includes(activityKey || '')) {
                        return null;
                      }
                      const panelTitle = activityKey === 'training_applicazione_lac'
                        ? 'Contatto Cliente (Training Applicazione LAC)'
                        : activityKey === 'verifica_non_adattamento'
                          ? 'Richiamo Cliente (Verifica Non Adattamento)'
                          : 'Richiamo Cliente (Verifica Tecnica)';
                      return (
                      <div className={`mt-4 border rounded-lg p-4 ${
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
                          {panelTitle}
                        </h4>

                        {telefonataCompletata ? (
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
                            {canEdit && (
                              <button
                                onClick={handleCancelPhoneRequest}
                                disabled={isSavingPhoneRequest}
                                className="w-full mt-2 flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                              >
                                Resetta
                              </button>
                            )}
                          </div>
                        ) : richiedeTelefonata ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-red-700">
                              <Phone className="w-4 h-4 animate-pulse" />
                              <span className="text-sm font-medium">Da contattare</span>
                            </div>
                            <p className="text-xs text-gray-700">
                              Assegnata a: <strong>{telefonataAssegnataA || 'Non assegnata'}</strong>
                            </p>

                            {canEdit && (showingCallOutcome ? (
                              <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-700 mb-2">Esito della chiamata:</p>
                                <button
                                  onClick={handleMarkPhoneCallDone}
                                  disabled={isSavingPhoneRequest}
                                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {isSavingPhoneRequest ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                  )}
                                  Telefonata andata a buon fine
                                </button>
                                <button
                                  onClick={handleMarkPhoneCallNoAnswer}
                                  disabled={isSavingPhoneRequest}
                                  className="w-full flex items-center justify-center px-4 py-2 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {isSavingPhoneRequest ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Phone className="w-4 h-4 mr-2" />
                                  )}
                                  Nessuna risposta - richiamare
                                </button>
                                <button
                                  onClick={() => setShowingCallOutcome(false)}
                                  disabled={isSavingPhoneRequest}
                                  className="w-full flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                  Annulla
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowingCallOutcome(true)}
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
                            ))}

                            {canEdit && (
                              <button
                                onClick={handleCancelPhoneRequest}
                                disabled={isSavingPhoneRequest}
                                className="w-full flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Annulla richiesta
                              </button>
                            )}
                          </div>
                        ) : (
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
                              disabled={!canEdit}
                            >
                              <option value="">Seleziona...</option>
                              {PHONE_ASSIGNEES.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Motivo urgenza (follow-up tecnico)
                            </label>
                            <textarea
                              value={telefonataMotivo}
                              onChange={(e) => setTelefonataMotivo(e.target.value)}
                              rows={3}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              placeholder={lavorazione.note || 'Motivo o note da associare al follow-up'}
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Pianifica richiamo (data/ora)
                            </label>
                            <input
                              type="datetime-local"
                              value={telefonataScheduledAt}
                              onChange={(e) => setTelefonataScheduledAt(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              disabled={!canEdit}
                            />
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleSavePhoneRequest(lavorazione.note)}
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
                            )}
                          </div>
                        )}
                      </div>
                    );
                    })()}
                  </div>

                  {/* ✅ MODIFICA: Azioni solo per chi può editare */}
                  {isMounted && canEdit && (
                    <div className="flex flex-col space-y-2 ml-4">
                      {lavorazione.stato === 'in_corso' && (
                        <>
                          <button
                            onClick={() => {
                              if (!checklistComplete) {
                                alert('Completa la checklist prima di chiudere la lavorazione.');
                                return;
                              }
                              if (checklistItems.length > 0 && !canFillChecklist) {
                                alert('Completa prima il contatto cliente per chiudere la lavorazione.');
                                return;
                              }
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
              disabled={isMovingToReady || (busta.controllo_completato ?? false) || !controlloPrerequisitesMet}
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

              {!busta.controllo_completato && !controlloPrerequisitesMet && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  {!allLavorazioniCompleted && (
                    <p>Completa tutte le lavorazioni prima del controllo finale.</p>
                  )}
                  {!allChecklistsCompleted && (
                    <p>Completa tutte le checklist associate alle lavorazioni.</p>
                  )}
                  {!phoneRequirementSatisfied && (
                    <p>Completa la telefonata richiesta al cliente.</p>
                  )}
                </div>
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

      {controlliQualita.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Storico controlli qualità</h3>
          <div className="space-y-2">
            {controlliQualita.map((entry) => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm text-gray-700">
                <div className="font-medium">Controllo #{entry.cycle_index}</div>
                <div className="text-gray-600">
                  {entry.profiles?.full_name || 'Utente'} •{' '}
                  {new Date(entry.completed_at).toLocaleString('it-IT')}
                </div>
              </div>
            ))}
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
