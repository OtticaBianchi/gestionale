// app/dashboard/_components/MultiStepBustaForm.tsx
'use client';

import { useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/database.types';
import {
  User,
  Package,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  X
} from 'lucide-react';

const isValidEmail = (rawEmail: string): boolean => {
  const email = rawEmail.trim();
  if (!email) return false;
  if (email.includes(' ')) return false;

  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return false;
  if (email.indexOf('@', atIndex + 1) !== -1) return false;

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (!localPart || !domainPart) return false;
  if (domainPart.startsWith('-') || domainPart.startsWith('.')) return false;
  if (domainPart.includes('..')) return false;

  const lastDotIndex = domainPart.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === domainPart.length - 1) return false;

  const tld = domainPart.slice(lastDotIndex + 1);
  if (tld.length < 2) return false;

  return true;
};

// ✅ AGGIUNTA INTERFACCIA PROPS
interface MultiStepBustaFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ✅ AGGIUNTA DESTRUCTURING PROPS
export default function MultiStepBustaForm({ onSuccess, onCancel }: MultiStepBustaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cliente_cognome: '',
    cliente_nome: '',
    cliente_data_nascita: '',
    cliente_genere: '' as '' | 'M' | 'F',
    cliente_telefono: '',
    cliente_email: '',
    cliente_note: '',
    tipo_lavorazione: '',
    priorita: 'normale' as 'normale' | 'urgente' | 'critica',
    note_generali: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // ✅ CLIENT SEARCH STATE
  const [searchType, setSearchType] = useState<'cognome' | 'telefono'>('cognome');
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Prevent double submit
  const isSubmittingRef = useRef(false);
  
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Validation function
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.cliente_cognome.trim() || formData.cliente_cognome.length < 2) {
      newErrors.cliente_cognome = 'Cognome obbligatorio (min 2 caratteri)';
    }
    if (!formData.cliente_nome.trim() || formData.cliente_nome.length < 2) {
      newErrors.cliente_nome = 'Nome obbligatorio (min 2 caratteri)';
    }
    if (!formData.cliente_data_nascita || Number.isNaN(Date.parse(formData.cliente_data_nascita))) {
      newErrors.cliente_data_nascita = 'Data nascita obbligatoria';
    }
    if (!formData.cliente_telefono || formData.cliente_telefono.replace(/\D/g, '').length < 9) {
      newErrors.cliente_telefono = 'Telefono obbligatorio (min 9 cifre)';
    }
    if (formData.cliente_email && !isValidEmail(formData.cliente_email)) {
      newErrors.cliente_email = 'Email non valida';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // ✅ SEARCH CLIENTS FUNCTION
  const handleSearchClients = async () => {
    if (!searchValue.trim()) {
      setFormError('Inserisci un valore per la ricerca');
      return;
    }

    setIsSearching(true);
    setFormError(null);

    try {
      let query = supabase.from('clienti').select('*');

      if (searchType === 'cognome') {
        // Search by last name (case-insensitive, starts with)
        query = query.ilike('cognome', `${searchValue}%`);
      } else {
        // Search by phone (exact match, removing spaces/dashes)
        const cleanPhone = searchValue.replace(/[\s\-]/g, '');
        query = query.ilike('telefono', `%${cleanPhone}%`);
      }

      const { data, error } = await query.order('cognome').order('nome').limit(20);

      if (error) throw error;

      setSearchResults(data || []);
      setShowResults(true);

      if (!data || data.length === 0) {
        setFormError(`Nessun cliente trovato con ${searchType === 'cognome' ? 'cognome' : 'telefono'}: "${searchValue}"`);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setFormError(`Errore nella ricerca: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ AUTOFILL FROM SELECTED CLIENT
  const handleSelectClient = (client: any) => {
    setFormData({
      ...formData,
      cliente_cognome: client.cognome || '',
      cliente_nome: client.nome || '',
      cliente_data_nascita: client.data_nascita || '',
      cliente_genere: client.genere || '',
      cliente_telefono: client.telefono || '',
      cliente_email: client.email || '',
      cliente_note: client.note_cliente || '',
    });

    // Clear search
    setShowResults(false);
    setSearchValue('');
    setSearchResults([]);
    setFormError(null);

    // Show success message
    const successMsg = `Cliente selezionato: ${client.cognome} ${client.nome}`;
    setFormError(null);
    setTimeout(() => {
      alert(successMsg);
    }, 100);
  };

  // ✅ CLEAR SEARCH AND START NEW CLIENT
  const handleNewClient = () => {
    setShowResults(false);
    setSearchValue('');
    setSearchResults([]);
    setFormData({
      cliente_cognome: '',
      cliente_nome: '',
      cliente_data_nascita: '',
      cliente_genere: '',
      cliente_telefono: '',
      cliente_email: '',
      cliente_note: '',
      tipo_lavorazione: formData.tipo_lavorazione,
      priorita: formData.priorita,
      note_generali: formData.note_generali
    });
    setErrors({});
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    
    if (!validateForm()) {
      setFormError('Per favore correggi gli errori nei campi evidenziati');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setFormError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      console.log('🔍 Creating busta with data:', formData);

      // ✅ Controlla se il cliente esiste già
      let { data: existingClient, error: clientError } = await supabase
        .from('clienti')
        .select('id')
        .eq('cognome', formData.cliente_cognome)
        .eq('nome', formData.cliente_nome)
        .eq('data_nascita', formData.cliente_data_nascita)
        .maybeSingle();

      if (clientError) throw clientError;

      let clienteId: string;

      if (existingClient) {
        clienteId = existingClient.id;
        console.log('✅ Cliente esistente trovato:', clienteId);
      } else {
        // ✅ AGGIUNTO CAMPO GENERE E NOTE CLIENTE NELLA CREAZIONE CLIENTE
        const { data: newClient, error: newClientError } = await supabase
          .from('clienti')
          .insert({
            cognome: formData.cliente_cognome,
            nome: formData.cliente_nome,
            data_nascita: formData.cliente_data_nascita,
            genere: formData.cliente_genere || null,
            telefono: formData.cliente_telefono,
            email: formData.cliente_email || null,
            note_cliente: formData.cliente_note || null,
          })
          .select('id')
          .single();

        if (newClientError) throw newClientError;
        if (!newClient) throw new Error("Creazione del cliente fallita.");
        clienteId = newClient.id;
        console.log('✅ Nuovo cliente creato:', clienteId);
      }

      // ✅ Gestione tipo_lavorazione
      const validWorkTypes = [
        'OCV', 'OV', 'OS', 'LV', 'LS', 'LAC', 'ACC', 'RIC', 'RIP', 
        'SA', 'SG', 'CT', 'ES', 'REL', 'FT', 'SPRT'
      ] as const;
      
      let tipoLavorazioneValue: Database['public']['Enums']['work_type'] | null = null;
      
      if (formData.tipo_lavorazione && formData.tipo_lavorazione.trim() !== '') {
        if (validWorkTypes.includes(formData.tipo_lavorazione as any)) {
          tipoLavorazioneValue = formData.tipo_lavorazione as Database['public']['Enums']['work_type'];
        } else {
          console.warn('❌ Tipo lavorazione non valido:', formData.tipo_lavorazione);
        }
      }

      // ✅ Inserisci la busta
      const { data: newBusta, error: bustaError } = await supabase
        .from('buste')
        .insert({
          cliente_id: clienteId,
          tipo_lavorazione: tipoLavorazioneValue,
          priorita: formData.priorita,
          note_generali: formData.note_generali || null,
          creato_da: user.id,
          stato_attuale: 'nuove'
        })
        .select('id, readable_id')
        .single();

      if (bustaError) throw bustaError;
      if (!newBusta) throw new Error("Creazione della busta fallita.");

      console.log('✅ Busta creata con successo:', newBusta);

      // ✅ Inserisci entry iniziale nello storico
      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          busta_id: newBusta.id,
          stato: 'nuove',
          data_ingresso: new Date().toISOString(),
          operatore_id: user.id,
          note_stato: 'Busta creata'
        });

      if (historyError) {
        console.warn('❌ Errore inserimento storico:', historyError);
        // Non blocchiamo per questo errore
      }

      // ✅ Success - show success screen
      setSuccess(true);
      
      // ❌ RIMOSSO: Non chiamare onSuccess automaticamente
      // L'utente deve scegliere cosa fare dalla pagina di successo
      // onSuccess?.();

    } catch (error: any) {
      setFormError(error.message);
      console.error('❌ Errore creazione busta:', error);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // ✅ FUNZIONE PER RESET FORM
  const resetForm = () => {
    setSuccess(false);
    setFormData({
      cliente_cognome: '',
      cliente_nome: '',
      cliente_data_nascita: '',
      cliente_genere: '',
      cliente_telefono: '',
      cliente_email: '',
      cliente_note: '',
      tipo_lavorazione: '',
      priorita: 'normale',
      note_generali: ''
    });
    setErrors({});
    setFormError(null);
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-lg border border-green-200 p-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Busta Creata!</h2>
            <p className="text-gray-600 mb-6">La nuova busta è stata aggiunta al sistema</p>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  // ✅ USA LA CALLBACK SE DISPONIBILE, altrimenti fallback al router
                  if (onSuccess) {
                    onSuccess();
                  } else {
                    router.push('/dashboard');
                    router.refresh();
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Vai alla Dashboard
              </button>
              <button 
                onClick={resetForm}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Crea Altra Busta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Nuova Busta</h1>
            {/* ✅ PULSANTE ANNULLA (se onCancel è presente) */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
            )}
          </div>
          <p className="text-gray-500 text-sm">Compila tutti i campi e clicca "Crea Busta"</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">

          {/* ✅ CLIENT SEARCH SECTION */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  Cerca Cliente Esistente
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Prima di creare una nuova anagrafica, verifica se il cliente è già presente nel sistema.
                  Cerca per cognome o numero di telefono.
                </p>
              </div>
            </div>

            {/* Search Controls */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Type Selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchType('cognome');
                      setSearchValue('');
                      setShowResults(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'cognome'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📝 Cognome
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchType('telefono');
                      setSearchValue('');
                      setShowResults(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'telefono'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📞 Telefono
                  </button>
                </div>

                {/* Search Input */}
                <div className="flex-1 flex gap-2">
                  <input
                    type={searchType === 'telefono' ? 'tel' : 'text'}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchClients()}
                    placeholder={searchType === 'cognome' ? 'Es: Rossi' : 'Es: 333 123 4567'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSearchClients}
                    disabled={isSearching || !searchValue.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">Ricerca...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span className="hidden sm:inline">Cerca</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {showResults && searchResults.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      📋 Risultati ({searchResults.length}):
                    </h3>
                    <button
                      type="button"
                      onClick={handleNewClient}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ➕ Nuovo Cliente
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full text-left p-3 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {client.cognome} {client.nome}
                            </p>
                            <p className="text-sm text-gray-600">
                              📅 {client.data_nascita ? new Date(client.data_nascita).toLocaleDateString('it-IT') : 'N/A'}
                              {client.telefono && ` • 📞 ${client.telefono}`}
                            </p>
                          </div>
                          <span className="text-blue-600">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Message */}
              {showResults && searchResults.length === 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Nessun cliente trovato. Puoi procedere con l'inserimento di un nuovo cliente.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewClient}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ➕ Inserisci Nuovo Cliente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cliente Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Dati Cliente
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cliente-cognome" className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                <input
                  id="cliente-cognome"
                  type="text"
                  value={formData.cliente_cognome}
                  onChange={(e) => handleInputChange('cliente_cognome', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cliente_cognome ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Rossi"
                />
                {errors.cliente_cognome && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_cognome}</p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-nome" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  id="cliente-nome"
                  type="text"
                  value={formData.cliente_nome}
                  onChange={(e) => handleInputChange('cliente_nome', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cliente_nome ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Mario"
                />
                {errors.cliente_nome && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_nome}</p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-data-nascita" className="block text-sm font-medium text-gray-700 mb-1">Data Nascita *</label>
                <input
                  id="cliente-data-nascita"
                  type="date"
                  value={formData.cliente_data_nascita}
                  onChange={(e) => handleInputChange('cliente_data_nascita', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cliente_data_nascita ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.cliente_data_nascita && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_data_nascita}</p>
                )}
              </div>

              {/* ✅ CAMPO GENERE */}
              <div>
                <label htmlFor="cliente-genere" className="block text-sm font-medium text-gray-700 mb-1">Genere</label>
                <select
                  id="cliente-genere"
                  value={formData.cliente_genere}
                  onChange={(e) => handleInputChange('cliente_genere', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Non specificato</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                </select>
              </div>

              <div>
                <label htmlFor="cliente-telefono" className="block text-sm font-medium text-gray-700 mb-1">Telefono *</label>
                <input
                  id="cliente-telefono"
                  type="tel"
                  value={formData.cliente_telefono}
                  onChange={(e) => handleInputChange('cliente_telefono', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cliente_telefono ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="333 123 4567"
                />
                {errors.cliente_telefono && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_telefono}</p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="cliente-email"
                  type="email"
                  value={formData.cliente_email}
                  onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.cliente_email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="mario@email.com"
                />
                {errors.cliente_email && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_email}</p>
                )}
              </div>

              {/* Note Cliente */}
              <div className="md:col-span-3">
                <label htmlFor="cliente-note" className="block text-sm font-medium text-gray-700 mb-1">Note Cliente</label>
                <textarea
                  id="cliente-note"
                  value={formData.cliente_note}
                  onChange={(e) => handleInputChange('cliente_note', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Note aggiuntive sul cliente..."
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="my-6 border-gray-200" />

          {/* Lavorazione Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-600" />
              Dettagli Lavorazione
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tipo-lavorazione" className="block text-sm font-medium text-gray-700 mb-1">Tipo Lavorazione</label>
                <select
                  id="tipo-lavorazione"
                  value={formData.tipo_lavorazione}
                  onChange={(e) => handleInputChange('tipo_lavorazione', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Seleziona --</option>
                  <option value="OCV">👓 OCV - Occhiale completo</option>
                  <option value="OV">👓 OV - Montatura</option>
                  <option value="OS">🕶️ OS - Occhiale sole</option>
                  <option value="LV">🔍 LV - Lenti vista</option>
                  <option value="LS">🌅 LS - Lenti sole</option>
                  <option value="LAC">👁️ LAC - Lenti contatto</option>
                  <option value="ACC">🔧 ACC - Accessori</option>
                  <option value="RIC">🔄 RIC - Ricambio</option>
                  <option value="RIP">🔨 RIP - Riparazione</option>
                  <option value="SA">📐 SA - Sostituzione anticipata</option>
                  <option value="SG">🧵 SG - Sostituzione in garanzia</option>
                  <option value="CT">👁️ CT - Controllo tecnico</option>
                  <option value="ES">🔬 ES - Esercizi oculari</option>
                  <option value="REL">📋 REL - Relazione</option>
                  <option value="FT">🧾 FT - Fattura</option>
                  <option value="SPRT">🚴 SPRT - Sport</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
                <div className="flex gap-2">
                  {[
                    { value: 'normale', label: 'Normale', color: 'bg-green-100 text-green-700 border-green-200' },
                    { value: 'urgente', label: 'Urgente', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    { value: 'critica', label: 'Critica', color: 'bg-red-100 text-red-700 border-red-200' }
                  ].map(priority => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => handleInputChange('priorita', priority.value)}
                      className={`
                        flex-1 px-3 py-2 rounded-lg text-center text-xs font-medium border-2 transition-colors
                        ${formData.priorita === priority.value 
                          ? priority.color + ' border-current' 
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }
                      `}
                    >
                      {priority.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="note-generali" className="block text-sm font-medium text-gray-700 mb-1">Note Generali</label>
                <textarea
                  id="note-generali"
                  value={formData.note_generali}
                  onChange={(e) => handleInputChange('note_generali', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Note aggiuntive sulla lavorazione..."
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creazione in corso...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Crea Busta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
