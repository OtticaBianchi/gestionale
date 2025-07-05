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
  CheckCircle
} from 'lucide-react';

export default function MultiStepBustaForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cliente_cognome: '',
    cliente_nome: '',
    cliente_data_nascita: '',
    cliente_telefono: '',
    cliente_email: '',
    tipo_lavorazione: '',
    priorita: 'normale' as 'normale' | 'urgente' | 'critica',
    note_generali: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
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
    if (!formData.cliente_data_nascita || isNaN(Date.parse(formData.cliente_data_nascita))) {
      newErrors.cliente_data_nascita = 'Data nascita obbligatoria';
    }
    if (!formData.cliente_telefono || formData.cliente_telefono.replace(/\D/g, '').length < 9) {
      newErrors.cliente_telefono = 'Telefono obbligatorio (min 9 cifre)';
    }
    if (formData.cliente_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.cliente_email)) {
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
        const { data: newClient, error: newClientError } = await supabase
          .from('clienti')
          .insert({
            cognome: formData.cliente_cognome,
            nome: formData.cliente_nome,
            data_nascita: formData.cliente_data_nascita,
            telefono: formData.cliente_telefono,
            email: formData.cliente_email || null,
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
        'SA', 'SG', 'CT', 'ES', 'REL', 'FT'
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

    } catch (error: any) {
      setFormError(error.message);
      console.error('❌ Errore creazione busta:', error);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
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
                  router.push('/dashboard');
                  router.refresh();
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Vai alla Dashboard
              </button>
              <button 
                onClick={() => {
                  setSuccess(false);
                  setFormData({
                    cliente_cognome: '',
                    cliente_nome: '',
                    cliente_data_nascita: '',
                    cliente_telefono: '',
                    cliente_email: '',
                    tipo_lavorazione: '',
                    priorita: 'normale',
                    note_generali: ''
                  });
                  setErrors({});
                  setFormError(null);
                }}
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
          <h1 className="text-2xl font-bold text-gray-900">Nuova Busta</h1>
          <p className="text-gray-500 text-sm">Compila tutti i campi e clicca "Crea Busta"</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          
          {/* Cliente Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Dati Cliente
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
                <input 
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input 
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Nascita *</label>
                <input 
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono *</label>
                <input 
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Lavorazione</label>
                <select 
                  value={formData.tipo_lavorazione}
                  onChange={(e) => handleInputChange('tipo_lavorazione', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Seleziona --</option>
                  <option value="OCV">👓 OCV - Occhiale completo</option>
                  <option value="OV">👓 OV - Occhiale vista</option>
                  <option value="OS">🕶️ OS - Occhiale sole</option>
                  <option value="LV">🔍 LV - Lenti vista</option>
                  <option value="LS">🌅 LS - Lenti sole</option>
                  <option value="LAC">👁️ LAC - Lenti contatto</option>
                  <option value="ACC">🔧 ACC - Accessori</option>
                  <option value="RIC">🔄 RIC - Ricambio</option>
                  <option value="RIP">🔨 RIP - Riparazione</option>
                  <option value="SA">📐 SA - Sagomatura</option>
                  <option value="SG">🧵 SG - Stringatura</option>
                  <option value="CT">👁️ CT - Controllo vista</option>
                  <option value="ES">🔬 ES - Esame</option>
                  <option value="REL">📋 REL - Relazione</option>
                  <option value="FT">🧾 FT - Fattura</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Generali</label>
                <textarea 
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