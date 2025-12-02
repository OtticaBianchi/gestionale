'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Check, Trash2, Filter, FileText, Link as LinkIcon } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CasiNonPrevistiModal from '@/app/dashboard/_components/CasiNonPrevistiModal';

type UnpredictedCase = {
  id: string;
  description: string;
  context_category: string | null;
  severity: string;
  created_at: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
  created_by_profile: { full_name: string | null } | null;
  completed_by_profile: { full_name: string | null } | null;
};

interface CasiNonPrevistiListProps {
  cases: UnpredictedCase[];
  isAdmin: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  accoglienza: 'Accoglienza',
  vendita: 'Vendita',
  appuntamenti: 'Appuntamenti',
  sala_controllo: 'Sala Controllo',
  lavorazioni: 'Lavorazioni',
  consegna: 'Consegna',
  customer_care: 'Customer Care',
  amministrazione: 'Amministrazione',
  it: 'IT',
  sport: 'Sport',
  straordinarie: 'Straordinarie',
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  bassa: { label: 'Bassa', color: 'bg-green-100 text-green-700 border-green-300', icon: '🟢' },
  media: { label: 'Media', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '🟡' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: '🟠' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-300', icon: '🔴' },
};

export default function CasiNonPrevistiList({ cases: initialCases, isAdmin }: CasiNonPrevistiListProps) {
  const [cases, setCases] = useState(initialCases);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const router = useRouter();

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleComplete = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('unpredicted_cases')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Caso segnato come completato');
      router.refresh();
    } catch (error) {
      console.error('Error completing case:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo caso?')) return;

    try {
      const { error } = await supabase
        .from('unpredicted_cases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Caso eliminato');
      router.refresh();
    } catch (error) {
      console.error('Error deleting case:', error);
      toast.error('Errore durante l\'eliminazione');
    }
  };

  // Filter cases
  const filteredCases = cases.filter(c => {
    if (!showCompleted && c.is_completed) return false;
    if (selectedCategory !== 'all' && c.context_category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && c.severity !== selectedSeverity) return false;
    return true;
  });

  const activeCases = cases.filter(c => !c.is_completed);
  const completedCases = cases.filter(c => c.is_completed);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Casi Attivi</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{activeCases.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Casi Completati</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{completedCases.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Totale</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{cases.length}</div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Filter by Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutte le categorie</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Filter by Severity */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutte le urgenze</option>
            {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.icon} {config.label}</option>
            ))}
          </select>

          {/* Show Completed Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              showCompleted
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {showCompleted ? 'Mostra solo attivi' : 'Mostra anche completati'}
          </button>
        </div>

        {/* Add New Case Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Nuovo Caso</span>
        </button>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {filteredCases.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nessun caso trovato</p>
          </div>
        ) : (
          filteredCases.map((caso) => (
            <div
              key={caso.id}
              className={`bg-white rounded-lg border-2 p-5 transition-all ${
                caso.is_completed ? 'border-green-200 opacity-60' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Header with badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {caso.context_category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {CATEGORY_LABELS[caso.context_category] || caso.context_category}
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${SEVERITY_CONFIG[caso.severity]?.color || ''}`}>
                      {SEVERITY_CONFIG[caso.severity]?.icon} {SEVERITY_CONFIG[caso.severity]?.label}
                    </span>
                    {caso.is_completed && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded border border-green-300">
                        ✅ Completato
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-900 whitespace-pre-wrap">{caso.description}</p>

                  {/* Footer info */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      Segnalato da <span className="font-medium">{caso.created_by_profile?.full_name || 'Sconosciuto'}</span>
                      {caso.created_at && <>{' '}il {new Date(caso.created_at).toLocaleString('it-IT')}</>}
                    </div>
                    {caso.is_completed && caso.completed_at && (
                      <div>
                        Completato da <span className="font-medium">{caso.completed_by_profile?.full_name || 'Sconosciuto'}</span>
                        {' '}il {new Date(caso.completed_at).toLocaleString('it-IT')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex flex-col gap-2">
                    {!caso.is_completed && (
                      <>
                        <Link
                          href="/procedure/admin"
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                          title="Crea nuova procedura da questo caso"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Crea Procedura</span>
                        </Link>
                        <Link
                          href="/procedure/admin"
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors whitespace-nowrap"
                          title="Modifica procedura esistente"
                        >
                          <LinkIcon className="h-4 w-4" />
                          <span>Modifica Procedura</span>
                        </Link>
                        <button
                          onClick={() => handleComplete(caso.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                          title="Segna come completato"
                        >
                          <Check className="h-4 w-4" />
                          <span>Completato</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(caso.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      title="Elimina questo caso"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Elimina</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for adding new case */}
      <CasiNonPrevistiModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
