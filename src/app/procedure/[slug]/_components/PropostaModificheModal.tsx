'use client';

import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { toast } from 'sonner';

interface PropostaModificheModalProps {
  isOpen: boolean;
  onClose: () => void;
  procedureId: string;
  procedureTitle: string;
}

export default function PropostaModificheModal({
  isOpen,
  onClose,
  procedureId,
  procedureTitle,
}: PropostaModificheModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Inserisci un titolo per la proposta');
      return;
    }

    if (!description.trim()) {
      toast.error('Inserisci una descrizione');
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
        .from('procedure_suggestions')
        .insert({
          procedure_id: procedureId,
          title: title.trim(),
          description: description.trim(),
          suggested_by: user.id,
        });

      if (error) throw error;

      toast.success('Proposta inviata con successo! Sarà valutata da un amministratore.');

      // Clear form
      setTitle('');
      setDescription('');

      onClose();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error('Errore durante l\'invio della proposta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Proponi Modifica</h2>
              <p className="text-sm text-gray-600 mt-1">{procedureTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Titolo della Proposta <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Es: Aggiungere passaggio per verifica finale"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione della Proposta <span className="text-red-600">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Descrivi in dettaglio la modifica che proponi e perché sarebbe utile..."
              required
            />
          </div>

          {/* Info Note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              💡 La tua proposta sarà valutata da un amministratore.
              Ti consigliamo di essere specifico e di spiegare i benefici della modifica proposta.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Invio in corso...' : 'Invia Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
