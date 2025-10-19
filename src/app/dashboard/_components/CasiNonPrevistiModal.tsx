'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { toast } from 'sonner';

interface CasiNonPrevistiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'accoglienza', label: 'Accoglienza' },
  { value: 'vendita', label: 'Vendita' },
  { value: 'appuntamenti', label: 'Appuntamenti' },
  { value: 'sala_controllo', label: 'Sala Controllo' },
  { value: 'lavorazioni', label: 'Lavorazioni' },
  { value: 'consegna', label: 'Consegna' },
  { value: 'customer_care', label: 'Customer Care' },
  { value: 'amministrazione', label: 'Amministrazione' },
  { value: 'it', label: 'IT' },
  { value: 'sport', label: 'Sport' },
  { value: 'straordinarie', label: 'Straordinarie' },
];

const SEVERITY_LEVELS = [
  { value: 'bassa', label: 'Bassa', color: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200', icon: '🟢' },
  { value: 'media', label: 'Media', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200', icon: '🟡' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200', icon: '🟠' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200', icon: '🔴' },
];

const DRAFT_KEY = 'casi_non_previsti_draft';

export default function CasiNonPrevistiModal({ isOpen, onClose }: CasiNonPrevistiModalProps) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setDescription(parsed.description || '');
        setCategory(parsed.category || '');
        setSeverity(parsed.severity || '');
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, [isOpen]);

  // Auto-save draft
  useEffect(() => {
    if (description || category || severity) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ description, category, severity }));
    }
  }, [description, category, severity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error('Inserisci una descrizione del caso');
      return;
    }

    if (!category) {
      toast.error('Seleziona una categoria');
      return;
    }

    if (!severity) {
      toast.error('Seleziona il livello di urgenza');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Devi essere autenticato');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('unpredicted_cases')
        .insert({
          description: description.trim(),
          context_category: category,
          severity,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Caso segnalato con successo');

      // Clear form and draft
      setDescription('');
      setCategory('');
      setSeverity('');
      localStorage.removeItem(DRAFT_KEY);

      onClose();
    } catch (error) {
      console.error('Error submitting case:', error);
      toast.error('Errore durante la segnalazione del caso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Keep draft when closing
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Segnala Caso NON Previsto</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Cosa è successo? <span className="text-red-600">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Descrivi il caso in dettaglio..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              La bozza viene salvata automaticamente
            </p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Categoria <span className="text-red-600">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Seleziona una categoria...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Quanto è urgente? <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEVERITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setSeverity(level.value)}
                  className={`
                    px-4 py-3 rounded-md border-2 transition-all font-medium text-sm
                    ${severity === level.value
                      ? level.color + ' ring-2 ring-offset-2 ring-current'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{level.icon}</span>
                    <span>{level.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
