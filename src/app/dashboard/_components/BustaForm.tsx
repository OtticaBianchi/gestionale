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

const formSchema = z.object({
  cliente_cognome: z.string().min(2, "Il cognome è obbligatorio"),
  cliente_nome: z.string().min(2, "Il nome è obbligatorio"),
  cliente_data_nascita: z.string().refine(val => val && !Number.isNaN(Date.parse(val)), { message: "Data non valida" }),
  cliente_telefono: z.string().min(9, "Numero di cellulare non valido"),
  cliente_email: z.string().email("Email non valida").optional().or(z.literal('')),
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
  { value: 'ACC', label: 'ACC - Accessori', icon: '🔧' },
  { value: 'RIC', label: 'RIC - Ricambio', icon: '⚙️' },
  { value: 'RIP', label: 'RIP - Riparazione', icon: '🔨' },
  { value: 'SA', label: 'SA - Sagomatura', icon: '✂️' },
  { value: 'SG', label: 'SG - Stringatura', icon: '🔩' },
  { value: 'CT', label: 'CT - Controllo vista', icon: '👁️‍🗨️' },
  { value: 'ES', label: 'ES - Esame specialistico', icon: '🏥' },
  { value: 'REL', label: 'REL - Relazione', icon: '📋' },
  { value: 'FT', label: 'FT - Fattura', icon: '🧾' }
];

export default function BustaForm() {
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tipiLavorazione, setTipiLavorazione] = useState<{codice: string, descrizione: string}[]>([]);

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

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priorita: 'normale',
      tipo_lavorazione: '',
    }
  });

  const watchedPriorita = watch('priorita');

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        let { data: existingClient, error: clientError } = await supabase
            .from('clienti')
            .select('id')
            .eq('cognome', data.cliente_cognome)
            .eq('nome', data.cliente_nome)
            .eq('data_nascita', data.cliente_data_nascita)
            .maybeSingle();

        if (clientError) throw clientError;

        let clienteId: string;

        if (existingClient) {
            clienteId = existingClient.id;
        } else {
            const { data: newClient, error: newClientError } = await supabase
                .from('clienti')
                .insert({
                    cognome: data.cliente_cognome,
                    nome: data.cliente_nome,
                    data_nascita: data.cliente_data_nascita,
                    telefono: data.cliente_telefono,
                    email: data.cliente_email,
                })
                .select('id')
                .single();

            if (newClientError) throw newClientError;
            if (!newClient) throw new Error("Creazione del cliente fallita.");
            clienteId = newClient.id;
        }

        const { error: bustaError } = await supabase.from('buste').insert({
            cliente_id: clienteId,
            tipo_lavorazione: data.tipo_lavorazione && data.tipo_lavorazione !== '' 
                ? data.tipo_lavorazione as WorkType 
                : null,
            priorita: data.priorita,
            note_generali: data.note_generali || null,
            creato_da: user.id,
        });

        if (bustaError) throw bustaError;

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
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Cognome *
                </label>
                <input 
                  type="text" 
                  {...register('cliente_cognome')} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Inserisci il cognome"
                />
                {errors.cliente_cognome && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_cognome.message}
                  </p>
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
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Data di Nascita *
                </label>
                <input 
                  type="date" 
                  {...register('cliente_data_nascita')} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {errors.cliente_data_nascita && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_data_nascita.message}
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
                />
                {errors.cliente_telefono && (
                  <p className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {errors.cliente_telefono.message}
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