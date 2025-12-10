'use client';

import { useState } from 'react';
import { User, Plus, Trash2, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

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

type ClientFormData = {
  cognome: string;
  nome: string;
  genere: '' | 'M' | 'F' | 'P.Giuridica';
  telefono: string;
  email: string;
};

type ClientFormResult = {
  index: number;
  status: 'pending' | 'success' | 'error';
  message?: string;
  data: ClientFormData;
};

export default function ManualClientForm() {
  const [clients, setClients] = useState<ClientFormData[]>([
    { cognome: '', nome: '', genere: '', telefono: '', email: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ClientFormResult[]>([]);

  const addClientRow = () => {
    if (clients.length < 9) {
      setClients([...clients, { cognome: '', nome: '', genere: '', telefono: '', email: '' }]);
    }
  };

  const removeClientRow = (index: number) => {
    if (clients.length > 1) {
      setClients(clients.filter((_, i) => i !== index));
    }
  };

  const updateClient = (index: number, field: keyof ClientFormData, value: string) => {
    const updated = [...clients];
    if (field === 'nome' || field === 'cognome') {
      updated[index][field] = capitalizeNameProperly(value);
    } else {
      updated[index][field] = value as any;
    }
    setClients(updated);
  };

  const validateClient = (client: ClientFormData): string | null => {
    if (!client.cognome.trim() || client.cognome.length < 2) {
      return 'Cognome obbligatorio (min 2 caratteri)';
    }
    if (!client.nome.trim() || client.nome.length < 2) {
      return 'Nome obbligatorio (min 2 caratteri)';
    }
    if (!client.genere) {
      return 'Genere obbligatorio';
    }
    if (!client.telefono.trim() || client.telefono.replace(/\D/g, '').length < 9) {
      return 'Telefono obbligatorio (min 9 cifre)';
    }
    if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
      return 'Email non valida';
    }
    return null;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setResults([]);

    const validatedClients: ClientFormResult[] = [];

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const error = validateClient(client);

      if (error) {
        validatedClients.push({
          index: i,
          status: 'error',
          message: error,
          data: client
        });
        continue;
      }

      try {
        const response = await fetch('/api/admin/import-clienti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cognome: client.cognome,
            nome: client.nome,
            genere: client.genere,
            telefono: client.telefono,
            email: client.email || null
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          validatedClients.push({
            index: i,
            status: 'success',
            message: 'Cliente importato con successo',
            data: client
          });
        } else {
          validatedClients.push({
            index: i,
            status: 'error',
            message: result.error || 'Errore durante l\'importazione',
            data: client
          });
        }
      } catch (error: any) {
        validatedClients.push({
          index: i,
          status: 'error',
          message: error.message || 'Errore di rete',
          data: client
        });
      }
    }

    setResults(validatedClients);
    setIsSubmitting(false);

    // Remove successful clients from the form
    const failedClients = validatedClients
      .filter(r => r.status === 'error')
      .map(r => r.data);

    if (failedClients.length === 0) {
      // All successful - reset form
      setClients([{ cognome: '', nome: '', genere: '', telefono: '', email: '' }]);
    } else {
      // Keep only failed clients in the form
      setClients(failedClients);
    }
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📝 Inserimento Manuale Clienti</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Puoi aggiungere fino a 9 clienti contemporaneamente</li>
          <li>• I campi Nome, Cognome, Genere e Telefono sono obbligatori</li>
          <li>• L'email è opzionale ma viene validata se fornita</li>
          <li>• Nome e Cognome verranno automaticamente formattati (Prima lettera maiuscola)</li>
        </ul>
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Riepilogo Importazione</h3>
          <div className="flex gap-4">
            {successCount > 0 && (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{successCount} importati</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">{errorCount} errori</span>
              </div>
            )}
          </div>

          {/* Error Details */}
          {results.filter(r => r.status === 'error').length > 0 && (
            <div className="mt-4 space-y-2">
              {results.filter(r => r.status === 'error').map((result, idx) => (
                <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm font-medium text-red-900">
                    Cliente {result.index + 1}: {result.data.nome} {result.data.cognome}
                  </p>
                  <p className="text-sm text-red-700 mt-1">{result.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Client Forms */}
      <div className="space-y-4">
        {clients.map((client, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente {index + 1}
              </h3>
              {clients.length > 1 && (
                <button
                  onClick={() => removeClientRow(index)}
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cognome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome *
                </label>
                <input
                  type="text"
                  value={client.cognome}
                  onChange={(e) => updateClient(index, 'cognome', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Rossi"
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={client.nome}
                  onChange={(e) => updateClient(index, 'nome', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Mario"
                />
              </div>

              {/* Genere */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Genere *
                </label>
                <select
                  value={client.genere}
                  onChange={(e) => updateClient(index, 'genere', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">-- Seleziona --</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                  <option value="P.Giuridica">🏢 P.Giuridica</option>
                </select>
              </div>

              {/* Telefono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono *
                </label>
                <input
                  type="tel"
                  value={client.telefono}
                  onChange={(e) => updateClient(index, 'telefono', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="333 123 4567"
                />
              </div>

              {/* Email */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (opzionale)
                </label>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => updateClient(index, 'email', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="mario.rossi@email.com"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {clients.length < 9 && (
          <button
            onClick={addClientRow}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Cliente
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || clients.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importazione in corso...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Importa {clients.length} Cliente{clients.length !== 1 ? 'i' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
