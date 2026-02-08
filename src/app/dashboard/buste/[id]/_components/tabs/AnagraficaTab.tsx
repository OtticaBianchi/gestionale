// ===== FILE: buste/[id]/_components/tabs/AnagraficaTab.tsx =====

'use client';

import { useEffect, useState } from 'react';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
import { formatPhoneDisplay } from '@/utils/formatPhone'; // ✅ IMPORT PHONE FORMATTER
import {
  User,
  Calendar,
  Package,
  Edit3,
  Save,
  X,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Eye // ✅ AGGIUNTO per banner read-only
} from 'lucide-react';
import PrintBustaButton from 'src/app/dashboard/_components/PrintBustaButton'; // ✅ IMPORT AGGIUNTO
import { useUser } from '@/context/UserContext';
import UnifiedNotesDisplay from '../UnifiedNotesDisplay';

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

type GenereCliente = 'M' | 'F' | 'P.Giuridica' | null;

type SurveyBadgeLevel = 'eccellente' | 'positivo' | 'attenzione' | 'critico';

type SurveyClientSummary = {
  cliente_id: string;
  responses_count: number;
  latest_response_at: string | null;
  avg_overall_score: number | null;
  latest_overall_score: number | null;
  latest_badge_level: SurveyBadgeLevel | null;
  latest_section_scores: Record<string, number> | null;
  followup_candidates_count: number;
  has_pending_followup: boolean;
  latest_suggestion?: string | null;
  response_history?: Array<{
    id: string;
    overall_score: number | null;
    submitted_at: string | null;
    created_at: string | null;
  }>;
};

// ===== UTILITY FUNCTION FOR NAME CAPITALIZATION =====
const capitalizeNameProperly = (name: string): string => {
  if (!name) return '';
  // Don't trim - preserve spaces while typing
  // Split by spaces and capitalize each word, preserving empty strings (spaces)
  return name
    .split(' ')
    .map(word => {
      if (!word) return ''; // preserve empty strings between spaces
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInputValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.split('T')[0] || '';
};

const parseDateInputValue = (value: string): Date | null => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const addDaysToInputValue = (value: string, days: number): string => {
  const date = parseDateInputValue(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const formatDateDisplay = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = parseDateInputValue(normalizeDateInputValue(value));
  return date ? date.toLocaleDateString('it-IT') : '—';
};

const formatDateTimeDisplay = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const SURVEY_BADGE_STYLES: Record<SurveyBadgeLevel, string> = {
  eccellente: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  positivo: 'bg-blue-100 text-blue-800 border border-blue-200',
  attenzione: 'bg-amber-100 text-amber-800 border border-amber-200',
  critico: 'bg-rose-100 text-rose-800 border border-rose-200'
};

const SURVEY_BADGE_LABELS: Record<SurveyBadgeLevel, string> = {
  eccellente: 'Eccellente',
  positivo: 'Positivo',
  attenzione: 'Attenzione',
  critico: 'Critico'
};

const SURVEY_SECTION_ORDER: Array<{ key: string; label: string }> = [
  { key: 'controllo_vista', label: 'CV' },
  { key: 'adattamento', label: 'Adattamento' },
  { key: 'prodotto', label: 'Prodotto Acquistato' },
  { key: 'servizio', label: 'Servizio Negozio' },
  { key: 'esperienza', label: 'Esperienza Ottica Bianchi' },
  { key: 'passaparola', label: 'Passaparola' }
];

const SURVEY_SECTION_ALIASES: Record<string, string> = {
  recommend: 'passaparola',
  overall: 'esperienza'
};

const normalizeSurveySectionEntries = (sectionScores: Record<string, number> | null | undefined) => {
  if (!sectionScores || typeof sectionScores !== 'object') return [] as Array<[string, number]>;

  const canonical = new Map<string, number>();
  for (const [rawKey, rawValue] of Object.entries(sectionScores)) {
    if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue;
    const key = SURVEY_SECTION_ALIASES[rawKey] || rawKey;
    if (!canonical.has(key)) {
      canonical.set(key, rawValue);
    }
  }

  const ordered = SURVEY_SECTION_ORDER
    .filter(({ key }) => canonical.has(key))
    .map(({ key }) => [key, canonical.get(key) as number] as [string, number]);

  const knownKeys = new Set(SURVEY_SECTION_ORDER.map(({ key }) => key));
  const extra = [...canonical.entries()].filter(([key]) => !knownKeys.has(key));
  return [...ordered, ...extra];
};

// Tipi props
interface AnagraficaTabProps {
  busta: BustaDettagliata;
  onBustaUpdate: (updatedBusta: BustaDettagliata) => void;
  isReadOnly?: boolean; // ✅ AGGIUNTO
}

export default function AnagraficaTab({ busta, onBustaUpdate, isReadOnly = false }: AnagraficaTabProps) {
  // ===== STATE =====
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [surveySummary, setSurveySummary] = useState<SurveyClientSummary | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const orderedSurveySections = normalizeSurveySectionEntries(surveySummary?.latest_section_scores || null);
  const surveyHistory = surveySummary?.response_history || [];
  const latestHistoryScore = typeof surveyHistory[0]?.overall_score === 'number' ? surveyHistory[0].overall_score : null;
  const previousHistoryScore = typeof surveyHistory[1]?.overall_score === 'number' ? surveyHistory[1].overall_score : null;
  const trendDelta = latestHistoryScore !== null && previousHistoryScore !== null
    ? Number((latestHistoryScore - previousHistoryScore).toFixed(2))
    : null;
  
  // User context for role checking
  const { profile } = useUser();
  
  // ✅ AGGIUNTO: Helper per controlli
  const canEdit = !isReadOnly;

  useEffect(() => {
    const clienteId = busta.clienti?.id;
    if (!clienteId) {
      setSurveySummary(null);
      setSurveyError(null);
      return;
    }

    let isCancelled = false;

    const fetchSurveySummary = async () => {
      setSurveyLoading(true);
      setSurveyError(null);
      try {
        const response = await fetch(`/api/clienti/${clienteId}/survey-summary`, {
          method: 'GET',
          cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success !== true) {
          throw new Error(payload?.error || 'Errore caricamento survey cliente');
        }

        const data = payload?.data || null;
        if (!isCancelled) {
          if (data && data.latest_section_scores && typeof data.latest_section_scores === 'string') {
            try {
              data.latest_section_scores = JSON.parse(data.latest_section_scores);
            } catch {
              data.latest_section_scores = null;
            }
          }
          setSurveySummary(data);
        }
      } catch (error: any) {
        if (!isCancelled) {
          setSurveySummary(null);
          setSurveyError(error?.message || 'Errore caricamento survey cliente');
        }
      } finally {
        if (!isCancelled) {
          setSurveyLoading(false);
        }
      }
    };

    fetchSurveySummary();

    return () => {
      isCancelled = true;
    };
  }, [busta.clienti?.id]);
  
  const [editForm, setEditForm] = useState({
    // ✅ Dati busta
    tipo_lavorazione: busta.tipo_lavorazione || '',
    priorita: busta.priorita,
    note_generali: busta.note_generali || '',
    is_suspended: busta.is_suspended,
    data_sospensione: normalizeDateInputValue(busta.data_sospensione),
    data_riesame_sospensione: normalizeDateInputValue(busta.data_riesame_sospensione),
    // ✅ Dati cliente - INCLUSO NUOVO CAMPO GENERE
    cliente_nome: busta.clienti?.nome || '',
    cliente_cognome: busta.clienti?.cognome || '',
    cliente_genere: busta.clienti?.genere || null as GenereCliente,  // ✅ NUOVO CAMPO
    cliente_telefono: busta.clienti?.telefono || '',
    cliente_email: busta.clienti?.email || '',
    cliente_note: busta.clienti?.note_cliente || '',
  });

  // ===== UTILITY FUNCTIONS =====
  const shouldShowTipoLenti = () => {
    const tipoLav = editForm.tipo_lavorazione || busta.tipo_lavorazione;
    return tipoLav === 'OCV' || tipoLav === 'LV';
  };

  // ===== VALIDATION FUNCTIONS =====
  const validateFormData = () => {
    if (!editForm.cliente_nome.trim() || !editForm.cliente_cognome.trim()) {
      throw new Error("Nome e cognome sono obbligatori");
    }
  };

  const validateWorkType = (): Database['public']['Enums']['work_type'] | null => {
    const validWorkTypes = [
      'OCV', 'OV', 'OS', 'LV', 'LS', 'LAC', 'TALAC', 'ACC', 'RIC', 'LAB',
      'SA', 'SG', 'CT', 'BR', 'SPRT', 'ES', 'REL', 'FT', 'VFT'
    ] as const;

    if (!editForm.tipo_lavorazione || editForm.tipo_lavorazione.trim() === '') {
      return null;
    }

    if (validWorkTypes.includes(editForm.tipo_lavorazione as any)) {
      return editForm.tipo_lavorazione as Database['public']['Enums']['work_type'];
    } else {
      throw new Error(`Tipo lavorazione non valido: ${editForm.tipo_lavorazione}`);
    }
  };

  type AnagraficaResponse = {
    success?: boolean;
    busta?: Partial<BustaDettagliata>;
    cliente?: Partial<BustaDettagliata['clienti']> | null;
    error?: string;
  };

  const updateLocalState = (
    tipoLavorazioneValue: Database['public']['Enums']['work_type'] | null,
    serverData?: AnagraficaResponse
  ) => {
    const updatedBusta = {
      ...busta,
      tipo_lavorazione: serverData?.busta?.tipo_lavorazione ?? tipoLavorazioneValue,
      priorita: serverData?.busta?.priorita ?? editForm.priorita,
      note_generali: serverData?.busta?.note_generali ?? (editForm.note_generali.trim() || null),
      is_suspended: serverData?.busta?.is_suspended ?? editForm.is_suspended,
      data_sospensione: serverData?.busta?.data_sospensione ?? (editForm.data_sospensione || null),
      data_riesame_sospensione: serverData?.busta?.data_riesame_sospensione ?? (editForm.data_riesame_sospensione || null),
      updated_at: serverData?.busta?.updated_at ?? new Date().toISOString(),
      clienti: busta.clienti
        ? {
            ...busta.clienti,
            ...serverData?.cliente,
            nome: serverData?.cliente?.nome ?? editForm.cliente_nome.trim(),
            cognome: serverData?.cliente?.cognome ?? editForm.cliente_cognome.trim(),
            genere: serverData?.cliente?.genere ?? editForm.cliente_genere,
            telefono: serverData?.cliente?.telefono ?? (editForm.cliente_telefono.trim() || null),
            email: serverData?.cliente?.email ?? (editForm.cliente_email.trim() || null),
            note_cliente: serverData?.cliente?.note_cliente ?? (editForm.cliente_note.trim() || null),
          }
        : (serverData?.cliente as BustaDettagliata['clienti'] | null) ?? null
    };

    onBustaUpdate(updatedBusta);
  };

  const handleSaveSuccess = async () => {
    await mutate('/api/buste');
    setSaveSuccess(true);
    setIsEditing(false);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // ===== MAIN SAVE FUNCTION =====
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      validateFormData();
      const tipoLavorazioneValue = validateWorkType();
      const todayInput = formatDateInput(new Date());
      const sospensioneDate = editForm.is_suspended
        ? (editForm.data_sospensione || todayInput)
        : null;
      const riesameDate = editForm.is_suspended && sospensioneDate
        ? (editForm.data_riesame_sospensione || addDaysToInputValue(sospensioneDate, 3))
        : null;

      const payload = {
        tipo_lavorazione: tipoLavorazioneValue,
        priorita: editForm.priorita,
        note_generali: editForm.note_generali.trim() || null,
        is_suspended: editForm.is_suspended,
        data_sospensione: sospensioneDate,
        data_riesame_sospensione: riesameDate,
        cliente: {
          id: busta.clienti?.id,
          nome: editForm.cliente_nome.trim(),
          cognome: editForm.cliente_cognome.trim(),
          genere: editForm.cliente_genere,
          telefono: editForm.cliente_telefono.trim() || null,
          email: editForm.cliente_email.trim() || null,
          note_cliente: editForm.cliente_note.trim() || null,
        }
      };

      const response = await fetch(`/api/buste/${busta.id}/anagrafica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result: AnagraficaResponse = await response
        .json()
        .catch(() => ({} as AnagraficaResponse));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Errore aggiornamento anagrafica');
      }

      updateLocalState(tipoLavorazioneValue, result);
      await handleSaveSuccess();

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
      data_sospensione: normalizeDateInputValue(busta.data_sospensione),
      data_riesame_sospensione: normalizeDateInputValue(busta.data_riesame_sospensione),
      cliente_nome: busta.clienti?.nome || '',
      cliente_cognome: busta.clienti?.cognome || '',
      cliente_genere: busta.clienti?.genere || null,  // ✅ NUOVO CAMPO
      cliente_telefono: busta.clienti?.telefono || '',
      cliente_email: busta.clienti?.email || '',
      cliente_note: busta.clienti?.note_cliente || '',
    });
    setIsEditing(false);
    setSaveSuccess(false);
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
                Come operatore puoi visualizzare i dettagli ma non effettuare modifiche.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Modifiche salvate con successo!</span>
        </div>
      )}

      {/* Informazioni Cliente - ORA MODIFICABILI CON GENERE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-500" />
            Informazioni Cliente
          </h2>
          
          <div className="flex items-center space-x-2">
            {/* ✅ PULSANTE STAMPA - SEMPRE VISIBILE */}
            {busta.clienti && (
              <PrintBustaButton
                bustaData={{
                  id: busta.id,
                  readable_id: busta.readable_id,
                  cliente_nome: busta.clienti.nome,
                  cliente_cognome: busta.clienti.cognome,
                  cliente_telefono: busta.clienti.telefono,
                  tipo_lavorazione: busta.tipo_lavorazione,
                  data_apertura: busta.data_apertura
                }}
                size="sm"
              />
            )}
            
            {/* ✅ MODIFICA: Indicatore modalità editing - SOLO SE canEdit */}
            {canEdit && isEditing && (
              <span className="text-sm text-blue-600 font-medium">Ora modificabile!</span>
            )}
          </div>
        </div>
        
        {busta.clienti ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-cliente-nome" className="block text-sm font-medium text-gray-500">Nome *</label>
              {canEdit && isEditing ? (
                <input
                  id="edit-cliente-nome"
                  type="text"
                  value={editForm.cliente_nome}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_nome: capitalizeNameProperly(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              ) : (
                <p className="text-lg font-medium text-gray-900">{busta.clienti.nome}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-cliente-cognome" className="block text-sm font-medium text-gray-500">Cognome *</label>
              {canEdit && isEditing ? (
                <input
                  id="edit-cliente-cognome"
                  type="text"
                  value={editForm.cliente_cognome}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_cognome: capitalizeNameProperly(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              ) : (
                <p className="text-lg font-medium text-gray-900">{busta.clienti.cognome}</p>
              )}
            </div>
            
            {/* ✅ NUOVO CAMPO GENERE */}
            <div>
              <label htmlFor="edit-cliente-genere" className="block text-sm font-medium text-gray-500">Genere</label>
              {canEdit && isEditing ? (
                <select
                  id="edit-cliente-genere"
                  value={editForm.cliente_genere || ''}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    cliente_genere: e.target.value === '' ? null : e.target.value as GenereCliente
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Non specificato</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                  <option value="P.Giuridica">🏢 P.Giuridica</option>
                </select>
              ) : (
                <p className="text-gray-900">
                  {busta.clienti.genere === 'M' ? '👨 Maschio' :
                   busta.clienti.genere === 'F' ? '👩 Femmina' :
                   busta.clienti.genere === 'P.Giuridica' ? '🏢 P.Giuridica' :
                   'Non specificato'}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="edit-cliente-telefono" className="block text-sm font-medium text-gray-500">Telefono</label>
              {canEdit && isEditing ? (
                <input
                  id="edit-cliente-telefono"
                  type="tel"
                  value={editForm.cliente_telefono}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                  onBlur={(e) => {
                    // ✅ Format phone on blur
                    const formatted = formatPhoneDisplay(e.target.value);
                    if (formatted && formatted !== e.target.value) {
                      setEditForm(prev => ({ ...prev, cliente_telefono: formatted }));
                    }
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="347 7282793"
                />
              ) : (
                busta.clienti.telefono ? (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-900">{formatPhoneDisplay(busta.clienti.telefono)}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Non specificato</p>
                )
              )}
            </div>
            
            <div>
              <label htmlFor="edit-cliente-email" className="block text-sm font-medium text-gray-500">Email</label>
              {canEdit && isEditing ? (
                <input
                  id="edit-cliente-email"
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
              <label htmlFor="edit-cliente-note" className="block text-sm font-medium text-gray-500">Note Cliente</label>
              {canEdit && isEditing ? (
                <textarea
                  id="edit-cliente-note"
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

      {/* Survey Soddisfazione Cliente */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-gray-500" />
            Survey Soddisfazione Cliente
          </h2>
        </div>

        {surveyLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Caricamento dati survey...</span>
          </div>
        ) : surveyError ? (
          <p className="text-sm text-rose-600">{surveyError}</p>
        ) : !surveySummary ? (
          <p className="text-sm text-gray-600">Nessuna risposta survey collegata a questo cliente.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {surveySummary.latest_badge_level && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${SURVEY_BADGE_STYLES[surveySummary.latest_badge_level]}`}>
                  {SURVEY_BADGE_LABELS[surveySummary.latest_badge_level]}
                </span>
              )}
              <span className="text-sm text-gray-700">
                Risposte collegate: <strong>{surveySummary.responses_count}</strong>
              </span>
              <span className="text-sm text-gray-700">
                Ultima risposta: <strong>{formatDateTimeDisplay(surveySummary.latest_response_at)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                <p className="text-xs uppercase tracking-wide text-gray-500">Ultimo Punteggio</p>
                <p className="text-lg font-semibold text-gray-900">
                  {typeof surveySummary.latest_overall_score === 'number' ? `${surveySummary.latest_overall_score.toFixed(2)}/100` : '—'}
                </p>
              </div>
              <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                <p className="text-xs uppercase tracking-wide text-gray-500">Trend (ultimo vs precedente)</p>
                <p className="text-lg font-semibold text-gray-900">
                  {trendDelta === null ? '—' : `${trendDelta > 0 ? '+' : ''}${trendDelta.toFixed(2)} pt`}
                </p>
              </div>
            </div>

            {orderedSurveySections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Sezioni (ultima risposta)</p>
                <div className="flex flex-wrap gap-2">
                  {orderedSurveySections.map(([sectionKey, value]) => (
                  <span
                    key={sectionKey}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    <span>{SURVEY_SECTION_ORDER.find((item) => item.key === sectionKey)?.label || sectionKey}</span>
                    <span>{typeof value === 'number' ? `${value.toFixed(1)}/100` : '—'}</span>
                  </span>
                  ))}
                </div>
              </div>
            )}

            {surveySummary.latest_suggestion && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
                <p className="text-xs uppercase tracking-wide text-blue-700 mb-1">Suggerimenti</p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{surveySummary.latest_suggestion}</p>
              </div>
            )}

            {surveyHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Storico risposte</p>
                <div className="space-y-1">
                  {surveyHistory.slice(0, 6).map((item) => (
                    <div key={item.id} className="text-xs text-gray-700 flex items-center justify-between rounded bg-gray-50 px-2 py-1 border border-gray-100">
                      <span>{formatDateTimeDisplay(item.submitted_at || item.created_at)}</span>
                      <span className="font-medium">{typeof item.overall_score === 'number' ? `${item.overall_score.toFixed(2)}/100` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {surveySummary.has_pending_followup && (
              <p className="text-sm text-amber-700">
                Sono presenti follow-up survey pendenti per questo cliente.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dettagli Lavorazione */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-gray-500" />
            Dettagli Lavorazione
          </h2>
          
          {/* ✅ MODIFICA: PULSANTE MODIFICA - NASCOSTO PER OPERATORI */}
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              <span>Modifica</span>
            </button>
          )}
          
          {/* ✅ MODIFICA: PULSANTI SALVA/ANNULLA - SOLO SE canEdit E isEditing */}
          {canEdit && isEditing && (
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
            <label htmlFor="tipo-lavorazione" className="block text-sm font-medium text-gray-500">Tipo Lavorazione</label>
            {canEdit && isEditing ? (
              <select
                id="tipo-lavorazione"
                value={editForm.tipo_lavorazione}
                onChange={(e) => setEditForm(prev => ({ ...prev, tipo_lavorazione: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">-- Da specificare --</option>
                <option value="OCV">👓 OCV - Occhiale da vista completo</option>
                <option value="OV">👓 OV - Montatura</option>
                <option value="OS">🕶️ OS - Occhiale da sole</option>
                <option value="LV">🔍 LV - Lenti da vista</option>
                <option value="LS">🌅 LS - Lenti da sole</option>
                <option value="LAC">👁️ LAC - Lenti a contatto</option>
                <option value="TALAC">👁️ TALAC - Training Applicativo LAC</option>
                <option value="ACC">🔧 ACC - Accessori</option>
                <option value="RIC">🔄 RIC - Ricambio</option>
                <option value="LAB">🧪 LAB - Laboratorio</option>
                <option value="SA">📐 SA - Sostituzione Anticipata</option>
                <option value="SG">🧵 SG - Sostituzione in Garanzia</option>
                <option value="CT">👁️ CT - Controllo tecnico</option>
                <option value="BR">🎁 BR - Buono Regalo</option>
                <option value="SPRT">🚴 SPRT - Sport</option>
                <option value="ES">🔬 ES - Esercizi oculari</option>
                <option value="REL">📋 REL - Relazione</option>
                <option value="FT">🧾 FT - Fattura</option>
                <option value="VFT">🔍 VFT - Verifica Fattibilità Tecnica</option>
                </select>
            ) : (
              <p className="text-gray-900">{busta.tipo_lavorazione || 'Da specificare'}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="priorita" className="block text-sm font-medium text-gray-500">Priorità</label>
            {canEdit && isEditing ? (
              <select
                id="priorita"
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
          
          {canEdit && isEditing && (
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editForm.is_suspended}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditForm(prev => {
                      if (!checked) {
                        return {
                          ...prev,
                          is_suspended: false,
                          data_sospensione: '',
                          data_riesame_sospensione: ''
                        };
                      }
                      const sospensioneDate = prev.data_sospensione || formatDateInput(new Date());
                      return {
                        ...prev,
                        is_suspended: true,
                        data_sospensione: sospensioneDate,
                        data_riesame_sospensione: prev.data_riesame_sospensione || addDaysToInputValue(sospensioneDate, 3)
                      };
                    });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                  Busta sospesa
                </span>
              </label>
            </div>
          )}

          {canEdit && isEditing && editForm.is_suspended && (
            <div className="md:col-span-2">
              <label htmlFor="data-sospensione" className="block text-sm font-medium text-gray-500">Data sospensione</label>
              <div className="flex flex-col gap-1">
                <input
                  id="data-sospensione"
                  type="date"
                  value={editForm.data_sospensione}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditForm(prev => ({
                      ...prev,
                      data_sospensione: value,
                      data_riesame_sospensione: value ? addDaysToInputValue(value, 3) : ''
                    }));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                {editForm.data_riesame_sospensione && (
                  <p className="text-xs text-gray-500">
                    Riesame sospensione: {formatDateDisplay(editForm.data_riesame_sospensione)} (3 giorni)
                  </p>
                )}
              </div>
            </div>
          )}

          {!isEditing && busta.is_suspended && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Sospensione</label>
              <p className="text-gray-900 text-sm">
                Dal {formatDateDisplay(busta.data_sospensione)} · Riesame {formatDateDisplay(busta.data_riesame_sospensione)}
              </p>
            </div>
          )}
          
          <div className="md:col-span-2">
            <label htmlFor="note-generali" className="block text-sm font-medium text-gray-500">Note Generali</label>
            {canEdit && isEditing ? (
              <textarea
                id="note-generali"
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

      {/* ===== UNIFIED NOTES DISPLAY ===== */}
      <UnifiedNotesDisplay bustaId={busta.id} />
    </div>
  );
}
