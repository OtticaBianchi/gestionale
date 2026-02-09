// app/dashboard/_components/BustaForm.tsx
'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as React from 'react';
import { Database } from '@/types/database.types';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Package, 
  AlertTriangle, 
  FileText,
  Save,
  X
} from 'lucide-react';

// Importiamo i tipi dal database invece di definirli manualmente
type WorkType = Database['public']['Enums']['work_type'];

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

const formSchema = z.object({
  cliente_cognome: z.string().min(2, "Il cognome è obbligatorio").transform(capitalizeNameProperly),
  cliente_nome: z.string().min(2, "Il nome è obbligatorio").transform(capitalizeNameProperly),
  cliente_genere: z.enum(['M', 'F', 'P.Giuridica'], {
    errorMap: () => ({ message: "Seleziona il genere" })
  }),
  cliente_telefono: z.string().min(9, "Numero di cellulare non valido"),
  cliente_email: z.string()
    .optional()
    .refine(val => {
      // If empty, it's valid (optional field)
      if (!val || val.trim() === '') return true;

      // Check basic format: something@something.ext
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) return false;

      // Check for common typos
      const lowerEmail = val.toLowerCase();
      if (lowerEmail.includes('claud')) return false; // catches claude, claudio typos
      if (lowerEmail.includes('gnail')) return false; // catches gmail typo
      if (lowerEmail.endsWith('.con')) return false; // catches .com typo

      return true;
    }, {
      message: "Email non valida. Verifica che non ci siano errori di battitura (es. 'gnail' invece di 'gmail', '.con' invece di '.com')"
    }),
  tipo_lavorazione: z.string().optional(),
  priorita: z.enum(['normale', 'urgente', 'critica']),
  note_generali: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const tipoLavorazioneOptions = [
  { value: 'OCV', label: 'OCV - Occhiale da vista completo', icon: '👓' },
  { value: 'OV', label: 'OV - Occhiale da vista', icon: '👓' },
  { value: 'OS', label: 'OS - Occhiale da sole', icon: '🕶️' },
  { value: 'LV', label: 'LV - Lenti da vista', icon: '🔍' },
  { value: 'LS', label: 'LS - Lenti da sole', icon: '☀️' },
  { value: 'LAC', label: 'LAC - Lenti a contatto', icon: '👁️' },
  { value: 'TALAC', label: 'TALAC - Training Applicativo LAC', icon: '👁️' },
  { value: 'ACC', label: 'ACC - Accessori', icon: '🔧' },
  { value: 'RIC', label: 'RIC - Ricambio', icon: '⚙️' },
  { value: 'LAB', label: 'LAB - Laboratorio', icon: '🧪' },
  { value: 'SA', label: 'SA - Sagomatura', icon: '✂️' },
  { value: 'SG', label: 'SG - Stringatura', icon: '🔩' },
  { value: 'CT', label: 'CT - Controllo vista', icon: '👁️‍🗨️' },
  { value: 'BR', label: 'BR - Buono Regalo', icon: '🎁' },
  { value: 'SPRT', label: 'SPRT - Sport', icon: '🚴' },
  { value: 'ES', label: 'ES - Esame specialistico', icon: '🏥' },
  { value: 'REL', label: 'REL - Relazione', icon: '📋' },
  { value: 'FT', label: 'FT - Fattura', icon: '🧾' },
  { value: 'VFT', label: 'VFT - Verifica Fattibilità Tecnica', icon: '🔍' },
  { value: 'VC', label: 'VC - Visita Controllo', icon: '👁️' }
];

type ClienteSuggestion = {
  id: string;
  cognome: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  genere: string | null;
};

export default function BustaForm() {
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  type CreateBustaResponse = {
    success?: boolean;
    busta?: any;
    cliente?: any;
    error?: string;
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tipiLavorazione, setTipiLavorazione] = useState<{codice: string, descrizione: string}[]>([]);
  const [clienteSuggestions, setClienteSuggestions] = useState<ClienteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Carica i tipi di lavorazione dal database
  React.useEffect(() => {
    const loadTipiLavorazione = async () => {
      const { data, error } = await supabase
        .from('tipi_lavorazione')
        .select('codice, descrizione')
        .order('codice');
      
      if (data && !error) {
        setTipiLavorazione(data);
      }
    };
    
    loadTipiLavorazione();
  }, []);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priorita: 'normale',
      tipo_lavorazione: '',
    }
  });

  const watchedPriorita = watch('priorita');
  const watchedCognome = watch('cliente_cognome');
  const watchedTelefono = watch('cliente_telefono');

  // Search for clients by surname
  React.useEffect(() => {
    const searchClients = async () => {
      if (!watchedCognome || watchedCognome.length < 2) {
        setClienteSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('clienti')
          .select('id, cognome, nome, telefono, email, genere')
          .ilike('cognome', `${watchedCognome}%`)
          .order('cognome', { ascending: true })
          .limit(10);

        if (error) throw error;

        if (data && data.length > 0) {
          setClienteSuggestions(data);
          setShowSuggestions(true);
        } else {
          setClienteSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error searching clients:', error);
        setClienteSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [watchedCognome, supabase]);

  // Search for clients by phone number
  React.useEffect(() => {
    const searchClientsByPhone = async () => {
      if (!watchedTelefono || watchedTelefono.length < 6) {
        return; // Don't clear suggestions if searching by surname
      }

      try {
        // Remove spaces and special chars for comparison
        const cleanPhone = watchedTelefono.replace(/[\s\-\.]/g, '');

        const { data, error } = await supabase
          .from('clienti')
          .select('id, cognome, nome, telefono, email, genere')
          .ilike('telefono', `%${cleanPhone}%`)
          .limit(10);

        if (error) throw error;

        if (data && data.length > 0) {
          setClienteSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error searching clients by phone:', error);
      }
    };

    const debounce = setTimeout(searchClientsByPhone, 300);
    return () => clearTimeout(debounce);
  }, [watchedTelefono, supabase]);

  const handleSelectClient = (client: ClienteSuggestion) => {
    setValue('cliente_cognome', client.cognome);
    setValue('cliente_nome', client.nome);
    setValue('cliente_telefono', client.telefono || '');
    setValue('cliente_email', client.email || '');
    setValue('cliente_genere', (client.genere as 'M' | 'F' | 'P.Giuridica') || 'M');
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.autocomplete-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
        const response = await fetch('/api/buste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente: {
              nome: data.cliente_nome.trim(),
              cognome: data.cliente_cognome.trim(),
              telefono: data.cliente_telefono.trim(),
              email: data.cliente_email?.trim() || null,
              genere: data.cliente_genere || null
            },
            busta: {
              tipo_lavorazione: data.tipo_lavorazione || null,
              priorita: data.priorita,
              note_generali: data.note_generali?.trim() || null,
              stato_attuale: 'nuove'
            }
          })
        });

        const result: CreateBustaResponse = await response
          .json()
          .catch(() => ({} as CreateBustaResponse));

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Errore creazione busta');
        }

        router.push('/dashboard');
        router.refresh();

    } catch (error: any) {
        setFormError(error.message);
        console.error("Errore nel salvataggio:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica': return 'border-red-500 bg-red-50 text-red-700';
      case 'urgente': return 'border-orange-500 bg-orange-50 text-orange-700';
      default: return 'border-gray-300 bg-white text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                Nuova Busta
              </h1>
              <p className="text-gray-500 mt-1">Crea una nuova lavorazione per il cliente</p>
            </div>
            
            <div className={`px-4 py-2 rounded-full border-2 ${getPriorityColor(watchedPriorita)} font-medium text-sm`}>
              Priorità: {watchedPriorita.charAt(0).toUpperCase() + watchedPriorita.slice(1)}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Sezione Cliente */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Informazioni Cliente
              </h2>
              <p className="text-blue-100 text-sm mt-1">Dati anagrafici del cliente</p>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative autocomplete-container">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Cognome *
                </label>
                <input
                  type="text"
                  {...register('cliente_cognome')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Inserisci il cognome"
                  autoComplete="off"
                  onFocus={() => {
                    if (clienteSuggestions.length > 0) setShowSuggestions(true);
                  }}
                />
                {errors.cliente_cognome && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_cognome.message}
                  </p>
                )}

                {/* Autocomplete Suggestions */}
                {showSuggestions && clienteSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium">
                      Clienti trovati - Clicca per compilare automaticamente
                    </div>
                    {clienteSuggestions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {client.cognome} {client.nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.genere === 'M' ? '👨' : client.genere === 'F' ? '👩' : client.genere === 'P.Giuridica' ? '🏢' : ''}
                          {client.telefono && ` 📞 ${client.telefono}`}
                          {client.email && ` • ${client.email}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Nome *
                </label>
                <input 
                  type="text" 
                  {...register('cliente_nome')} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Inserisci il nome"
                />
                {errors.cliente_nome && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_nome.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  Telefono *
                </label>
                <input
                  type="tel"
                  {...register('cliente_telefono')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="+39 123 456 7890"
                  autoComplete="off"
                  onFocus={() => {
                    if (clienteSuggestions.length > 0) setShowSuggestions(true);
                  }}
                />
                {errors.cliente_telefono && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_telefono.message}
                  </p>
                )}

                {/* Autocomplete Suggestions for Phone */}
                {showSuggestions && clienteSuggestions.length > 0 && watchedTelefono && watchedTelefono.length >= 6 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="px-3 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 font-medium">
                      Clienti trovati per numero - Clicca per compilare automaticamente
                    </div>
                    {clienteSuggestions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {client.cognome} {client.nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.genere === 'M' ? '👨' : client.genere === 'F' ? '👩' : client.genere === 'P.Giuridica' ? '🏢' : ''}
                          {client.telefono && ` 📞 ${client.telefono}`}
                          {client.email && ` • ${client.email}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Genere *
                </label>
                <select
                  {...register('cliente_genere')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">-- Seleziona --</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                  <option value="P.Giuridica">🏢 P.Giuridica</option>
                </select>
                {errors.cliente_genere && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_genere.message}
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email (opzionale)
                </label>
                <input
                  type="email"
                  {...register('cliente_email')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="email@esempio.com"
                />
                {errors.cliente_email && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_email.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sezione Lavorazione */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Package className="w-5 h-5" />
                Dettagli Lavorazione
              </h2>
              <p className="text-green-100 text-sm mt-1">Specifiche del lavoro da eseguire</p>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  Tipo Lavorazione
                </label>
                <select 
                  {...register('tipo_lavorazione')} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">-- Da specificare --</option>
                  {tipoLavorazioneOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  Priorità
                </label>
                <select 
                  {...register('priorita')} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="normale">🟢 Normale</option>
                  <option value="urgente">🟡 Urgente</option>
                  <option value="critica">🔴 Critica</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Note Generali
                </label>
                <textarea 
                  {...register('note_generali')} 
                  rows={4} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Aggiungi note o istruzioni particolari..."
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">{formError}</span>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-end gap-4">
              <button 
                type="button" 
                onClick={() => router.back()} 
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Creazione...' : 'Crea Busta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
