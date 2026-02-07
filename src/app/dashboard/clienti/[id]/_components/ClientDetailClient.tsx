'use client';

import { useEffect, useState } from 'react';
import { User, Calendar, Phone, Mail, ArrowLeft, Edit3, Save, X, Trash2, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPhoneDisplay } from '@/utils/formatPhone'; // ✅ IMPORT PHONE FORMATTER

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

type ClienteDettagliato = {
  id: string;
  nome: string;
  cognome: string;
  genere: string | null;
  telefono: string | null;
  email: string | null;
  data_nascita: string | null;
  note_cliente: string | null;
  categoria_cliente: string | null;
  created_at: string | null;
  updated_at: string | null;
  buste: Array<{
    id: string;
    readable_id: string;
    tipo_lavorazione: string | null;
    stato_attuale: string;
    priorita: string;
    data_apertura: string;
    data_completamento_consegna: string | null;
  }>;
  follow_up_chiamate: Array<{
    id: string;
    data_chiamata: string | null;
    livello_soddisfazione: string | null;
    stato_chiamata: string;
    note_chiamata: string | null;
  }>;
  error_tracking: Array<{
    id: string;
    error_type: string;
    error_category: string;
    error_description: string;
    created_at: string | null;
    resolution_status: string | null;
  }>;
};

interface ClientDetailClientProps {
  cliente: ClienteDettagliato;
  userRole: string;
}

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

const SURVEY_SECTION_LABELS: Record<string, string> = {
  servizio: 'Servizio',
  controllo_vista: 'Controllo Vista',
  esperienza: 'Esperienza',
  overall: 'Overall',
  recommend: 'Consiglio',
  prodotto: 'Prodotto'
};

export default function ClientDetailClient({ cliente, userRole }: ClientDetailClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'storico' | 'profilo'>('anagrafica');
  const [surveySummary, setSurveySummary] = useState<SurveyClientSummary | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    nome: cliente.nome,
    cognome: cliente.cognome,
    genere: cliente.genere,
    telefono: cliente.telefono || '',
    email: cliente.email || '',
    data_nascita: cliente.data_nascita ? cliente.data_nascita.substring(0, 4) : '', // Extract year only
    note_cliente: cliente.note_cliente || '',
  });

  const canEdit = userRole === 'admin' || userRole === 'manager';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    let isCancelled = false;

    const fetchSurveySummary = async () => {
      setSurveyLoading(true);
      setSurveyError(null);
      try {
        const response = await fetch(`/api/clienti/${cliente.id}/survey-summary`, {
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
  }, [cliente.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert year to ISO date format (YYYY-01-01) for storage
      const dataToSave = {
        ...editForm,
        data_nascita: editForm.data_nascita ? `${editForm.data_nascita}-01-01` : null,
      };

      const response = await fetch(`/api/clienti/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Error saving cliente:', error);
      alert('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/clienti/${cliente.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'eliminazione');
      }

      router.push('/dashboard/ricerca-avanzata');
    } catch (error) {
      console.error('Error deleting cliente:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleCancel = () => {
    setEditForm({
      nome: cliente.nome,
      cognome: cliente.cognome,
      genere: cliente.genere,
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      data_nascita: cliente.data_nascita ? cliente.data_nascita.substring(0, 4) : '',
      note_cliente: cliente.note_cliente || '',
    });
    setIsEditing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '—';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoriaColor = (categoria: string | null) => {
    const colors: Record<string, string> = {
      super_fan: 'bg-purple-100 text-purple-800',
      fan: 'bg-blue-100 text-blue-800',
      a_rischio: 'bg-yellow-100 text-yellow-800',
      critico: 'bg-red-100 text-red-800',
      perso: 'bg-gray-100 text-gray-800',
      delicato_su_comunicazione: 'bg-orange-100 text-orange-800',
      sensibile_al_prezzo: 'bg-green-100 text-green-800',
    };
    return colors[categoria || ''] || 'bg-gray-100 text-gray-800';
  };

  const getCategoriaLabel = (categoria: string | null) => {
    const labels: Record<string, string> = {
      super_fan: 'Super Fan',
      fan: 'Fan',
      a_rischio: 'A Rischio',
      critico: 'Critico',
      perso: 'Perso',
      delicato_su_comunicazione: 'Delicato su Comunicazione',
      sensibile_al_prezzo: 'Sensibile al Prezzo',
    };
    return labels[categoria || ''] || 'Non categorizzato';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/ricerca-avanzata"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {cliente.nome} {cliente.cognome}
              </h1>
              {cliente.categoria_cliente && (
                <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getCategoriaColor(cliente.categoria_cliente)}`}>
                  {getCategoriaLabel(cliente.categoria_cliente)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View All Buste Button */}
            <Link
              href={`/dashboard/ricerca-avanzata?cliente_id=${cliente.id}`}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Vedi Buste Cliente</span>
            </Link>

            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                <span>Modifica</span>
              </button>
            )}

            {canEdit && isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Salvataggio...' : 'Salva'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Annulla</span>
                </button>
              </>
            )}

            {canDelete && !isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Elimina</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('anagrafica')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'anagrafica'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Dati Anagrafici
          </button>
          <button
            onClick={() => setActiveTab('storico')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'storico'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Storico Attività
          </button>
          <button
            onClick={() => setActiveTab('profilo')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'profilo'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Profilo Cliente
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Sezione A: Dati Anagrafici */}
        {activeTab === 'anagrafica' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-500" />
              Informazioni Anagrafiche
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Nome *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.nome}
                    onChange={(e) => setEditForm({ ...editForm, nome: capitalizeNameProperly(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{cliente.nome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Cognome *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.cognome}
                    onChange={(e) => setEditForm({ ...editForm, cognome: capitalizeNameProperly(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{cliente.cognome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Genere</label>
                {isEditing ? (
                  <select
                    value={editForm.genere || ''}
                    onChange={(e) => setEditForm({ ...editForm, genere: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Non specificato</option>
                    <option value="M">👨 Maschio</option>
                    <option value="F">👩 Femmina</option>
                    <option value="P.Giuridica">🏢 P.Giuridica</option>
                  </select>
                ) : (
                  <p className="text-gray-900">
                    {cliente.genere === 'M' ? '👨 Maschio' :
                     cliente.genere === 'F' ? '👩 Femmina' :
                     cliente.genere === 'P.Giuridica' ? '🏢 P.Giuridica' :
                     'Non specificato'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Telefono
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.telefono}
                    onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                    onBlur={(e) => {
                      // ✅ Format phone on blur
                      const formatted = formatPhoneDisplay(e.target.value);
                      if (formatted && formatted !== e.target.value) {
                        setEditForm({ ...editForm, telefono: formatted });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="347 7282793"
                  />
                ) : (
                  <p className="text-gray-900">{formatPhoneDisplay(cliente.telefono) || 'Non specificato'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{cliente.email || 'Non specificata'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Anno di Nascita
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    placeholder="es. 1985"
                    value={editForm.data_nascita}
                    onChange={(e) => setEditForm({ ...editForm, data_nascita: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {cliente.data_nascita ? cliente.data_nascita.substring(0, 4) : 'Non specificato'}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">Note Cliente</label>
                {isEditing ? (
                  <textarea
                    value={editForm.note_cliente}
                    onChange={(e) => setEditForm({ ...editForm, note_cliente: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{cliente.note_cliente || 'Nessuna nota'}</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Survey Soddisfazione Cliente</h3>
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
                      Ultima risposta: <strong>{formatDateTime(surveySummary.latest_response_at)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Punteggio Medio</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof surveySummary.avg_overall_score === 'number' ? `${surveySummary.avg_overall_score.toFixed(2)}/100` : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Ultimo Punteggio</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof surveySummary.latest_overall_score === 'number' ? `${surveySummary.latest_overall_score.toFixed(2)}/100` : '—'}
                      </p>
                    </div>
                  </div>

                  {surveySummary.latest_section_scores && Object.keys(surveySummary.latest_section_scores).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(surveySummary.latest_section_scores).map(([sectionKey, value]) => (
                        <span
                          key={sectionKey}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                        >
                          <span>{SURVEY_SECTION_LABELS[sectionKey] || sectionKey}</span>
                          <span>{typeof value === 'number' ? `${value.toFixed(1)}/100` : '—'}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {surveySummary.has_pending_followup && (
                    <p className="text-sm text-amber-700">Sono presenti follow-up survey pendenti per questo cliente.</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Creato il:</span> {formatDate(cliente.created_at)}
                </div>
                <div>
                  <span className="font-medium">Ultimo aggiornamento:</span> {formatDate(cliente.updated_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sezione B: Storico Attività */}
        {activeTab === 'storico' && (
          <div className="space-y-6">
            {/* Buste */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Buste ({cliente.buste.length})
              </h2>
              {cliente.buste.length > 0 ? (
                <div className="space-y-3">
                  {cliente.buste
                    .sort((a, b) => new Date(b.data_apertura).getTime() - new Date(a.data_apertura).getTime())
                    .map((busta) => (
                      <Link
                        key={busta.id}
                        href={`/dashboard/buste/${busta.id}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{busta.readable_id}</p>
                            <p className="text-sm text-gray-600">{busta.tipo_lavorazione || 'Tipo non specificato'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{formatDate(busta.data_apertura)}</p>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                              busta.priorita === 'critica' ? 'bg-red-100 text-red-800' :
                              busta.priorita === 'urgente' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {busta.stato_attuale}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Nessuna busta registrata</p>
              )}
            </div>

            {/* Follow-up */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Follow-up ({cliente.follow_up_chiamate.length})
              </h2>
              {cliente.follow_up_chiamate.length > 0 ? (
                <div className="space-y-3">
                  {cliente.follow_up_chiamate
                    .sort((a, b) => {
                      const dateA = a.data_chiamata ? new Date(a.data_chiamata).getTime() : 0;
                      const dateB = b.data_chiamata ? new Date(b.data_chiamata).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((followup) => (
                      <div key={followup.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{followup.data_chiamata ? formatDate(followup.data_chiamata) : 'Data non disponibile'}</p>
                            <p className="text-sm text-gray-600 mt-1">{followup.stato_chiamata}</p>
                            {followup.note_chiamata && (
                              <p className="text-sm text-gray-600 mt-2">{followup.note_chiamata}</p>
                            )}
                          </div>
                          {followup.livello_soddisfazione && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              followup.livello_soddisfazione === 'molto_soddisfatto' ? 'bg-green-100 text-green-800' :
                              followup.livello_soddisfazione === 'soddisfatto' ? 'bg-blue-100 text-blue-800' :
                              followup.livello_soddisfazione === 'poco_soddisfatto' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {followup.livello_soddisfazione}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Nessun follow-up registrato</p>
              )}
            </div>

            {/* Errori */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Errori Associati ({cliente.error_tracking.length})
              </h2>
              {cliente.error_tracking.length > 0 ? (
                <div className="space-y-3">
                  {cliente.error_tracking
                    .sort((a, b) => {
                      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((error) => (
                      <div key={error.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{error.error_type || 'Tipo non specificato'}</p>
                            <p className="text-sm text-gray-600 mt-1">{error.error_description}</p>
                            <p className="text-xs text-gray-500 mt-2">{error.created_at ? formatDate(error.created_at) : 'Data non disponibile'}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            error.error_category === 'alto' ? 'bg-red-100 text-red-800' :
                            error.error_category === 'medio' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {error.resolution_status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Nessun errore registrato</p>
              )}
            </div>
          </div>
        )}

        {/* Sezione C: Profilo Cliente */}
        {activeTab === 'profilo' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profilo Cliente Intelligente</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <p className="text-blue-800 font-medium mb-2">🚀 Funzionalità in Arrivo</p>
              <p className="text-sm text-blue-700">
                Questa sezione mostrerà cluster, abitudini, preferenze rilevate, rischi previsti e note del team.
              </p>
              <p className="text-xs text-blue-600 mt-4">Disponibile prossimamente con il modulo Marketing & Intelligence</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conferma Eliminazione</h3>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare il cliente <strong>{cliente.nome} {cliente.cognome}</strong>?
              Questa azione è irreversibile.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Elimina
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
