// app/dashboard/_components/MultiStepBustaForm.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/database.types';
import { formatPhoneDisplay } from '@/utils/formatPhone'; // ✅ IMPORT PHONE FORMATTER
import {
  PLACEHOLDER_PHONE,
  normalizePhone,
  isPlaceholderPhone,
  isShopPhone,
  isOtticaBianchiName
} from '@/lib/clients/phoneRules';
import { ESITI, formatDataIt, importoPreventivo } from '@/lib/preventivi/types';
import {
  User,
  Package,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  X
} from 'lucide-react';

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
    cliente_id: null as string | null,  // ✅ AGGIUNTO per tracciare cliente esistente
    cliente_cognome: '',
    cliente_nome: '',
    cliente_genere: '' as '' | 'M' | 'F' | 'P.Giuridica',
    cliente_telefono: '',
    cliente_email: '',
    cliente_note: '',
    tipo_lavorazione: '',
    priorita: 'normale' as 'normale' | 'urgente' | 'critica',
    note_generali: '',
    anno_precedente: false  // ✅ AGGIUNTO per gestire buste anno precedente
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [noPhone, setNoPhone] = useState(false);

  // ✅ CLIENT SEARCH STATE
  const [searchType, setSearchType] = useState<'cognome' | 'telefono'>('cognome');
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // ✅ PHONE CONFLICT DETECTION STATE
  const [phoneConflicts, setPhoneConflicts] = useState<any[]>([]);
  const [showPhoneConflict, setShowPhoneConflict] = useState(false);
  const [selectedConflictResolution, setSelectedConflictResolution] = useState<'new' | 'existing' | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // ✅ PREVENTIVO DI PARTENZA (facoltativo): scelto dall'elenco o arrivato da "Crea busta"
  const [preventivoId, setPreventivoId] = useState<string | null>(null);
  const [preventivoUrl, setPreventivoUrl] = useState<any | null>(null);
  const [candidati, setCandidati] = useState<any[]>([]);
  const TIPI_CON_PREVENTIVO = ['OCV', 'LV', 'OV', 'LS'];

  // Prevent double submit
  const isSubmittingRef = useRef(false);
  
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // "Crea busta" dalla lista preventivi: /dashboard/buste/new?preventivo=<id> precompila cliente e tipo
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('preventivo');
    if (!id) return;
    let cancelled = false;
    fetch(`/api/preventivi/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.preventivo;
        if (cancelled || !p || p.busta_id) return;
        setPreventivoUrl(p);
        setPreventivoId(p.id);
        setNoPhone(isPlaceholderPhone(p.cliente_telefono));
        setFormData((prev) => ({
          ...prev,
          cliente_id: p.cliente_id || null,
          cliente_cognome: p.cliente_cognome || '',
          cliente_nome: p.cliente_nome || '',
          cliente_telefono: p.cliente_telefono || '',
          tipo_lavorazione: p.tipo === 'occhiali_completi' ? 'OCV' : p.tipo === 'lenti_graduate' ? 'LV' : prev.tipo_lavorazione,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Preventivi dello stesso cliente non ancora collegati (solo per vendita di lenti / occhiali completi)
  useEffect(() => {
    const phoneDigits = formData.cliente_telefono.replace(/\D/g, '');
    if (!TIPI_CON_PREVENTIVO.includes(formData.tipo_lavorazione) || (formData.cliente_cognome.trim().length < 2 && phoneDigits.length < 7)) {
      setCandidati([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({
        cognome: formData.cliente_cognome.trim(),
        nome: formData.cliente_nome.trim(),
        telefono: formData.cliente_telefono,
      });
      if (formData.cliente_id) qs.set('cliente_id', formData.cliente_id);
      try {
        const res = await fetch(`/api/preventivi/candidati?${qs.toString()}`);
        if (!cancelled && res.ok) setCandidati((await res.json()).preventivi || []);
      } catch {}
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.cliente_id, formData.cliente_cognome, formData.cliente_nome, formData.cliente_telefono, formData.tipo_lavorazione]);

  const preventiviMostrati = [
    ...(preventivoUrl && !candidati.some((c) => c.id === preventivoUrl.id) ? [preventivoUrl] : []),
    ...candidati,
  ];

  // Validation function
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    const normalizedPhone = normalizePhone(formData.cliente_telefono);
    const hasPlaceholderPhone = isPlaceholderPhone(formData.cliente_telefono);
    const usesShopPhone = isShopPhone(formData.cliente_telefono);
    const isOtticaBianchi = isOtticaBianchiName(formData.cliente_nome, formData.cliente_cognome);

    if (!formData.cliente_cognome.trim() || formData.cliente_cognome.length < 2) {
      newErrors.cliente_cognome = 'Cognome obbligatorio (min 2 caratteri)';
    }
    if (!formData.cliente_nome.trim() || formData.cliente_nome.length < 2) {
      newErrors.cliente_nome = 'Nome obbligatorio (min 2 caratteri)';
    }
    if (!formData.cliente_genere) {
      newErrors.cliente_genere = 'Genere obbligatorio';
    }
    if (noPhone) {
      if (!hasPlaceholderPhone) {
        newErrors.cliente_telefono = `Telefono non disponibile: usa ${PLACEHOLDER_PHONE}`;
      }
    } else if (!normalizedPhone || normalizedPhone.length < 9) {
      newErrors.cliente_telefono = 'Telefono obbligatorio (min 9 cifre)';
    }
    if (usesShopPhone && !isOtticaBianchi) {
      newErrors.cliente_telefono = 'Numero negozio consentito solo per Ottica Bianchi';
    }
    if (!formData.cliente_id && usesShopPhone && isOtticaBianchi) {
      newErrors.cliente_telefono = 'Cliente Ottica Bianchi già presente: selezionalo dalla ricerca';
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

  const handlePhoneChange = (value: string) => {
    handleInputChange('cliente_telefono', value);
    if (isPlaceholderPhone(value)) {
      setNoPhone(true);
    } else if (noPhone) {
      setNoPhone(false);
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
      const term = searchValue.trim();
      let query = supabase.from('clienti').select('*').is('deleted_at', null);

      if (searchType === 'cognome') {
        // Search by surname/name (contains) to reduce false "not found" on partial queries
        const safeTerm = term.replace(/,/g, ' ');
        query = query.or(`cognome.ilike.%${safeTerm}%,nome.ilike.%${safeTerm}%`);
      } else {
        // Search by phone (exact match, removing spaces/dashes)
        const cleanPhone = term.replace(/[\s\-]/g, '');
        query = query.ilike('telefono', `%${cleanPhone}%`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false }).order('cognome').order('nome').limit(30);

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
      cliente_id: client.id,  // ✅ SALVA L'ID DEL CLIENTE ESISTENTE
      cliente_cognome: client.cognome || '',
      cliente_nome: client.nome || '',
      cliente_genere: client.genere || '',
      cliente_telefono: client.telefono || '',
      cliente_email: client.email || '',
      cliente_note: client.note_cliente || '',
    });
    setNoPhone(isPlaceholderPhone(client.telefono));

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
      cliente_id: null,  // ✅ RESET ID
      cliente_cognome: '',
      cliente_nome: '',
      cliente_genere: '',
      cliente_telefono: '',
      cliente_email: '',
      cliente_note: '',
      tipo_lavorazione: formData.tipo_lavorazione,
      priorita: formData.priorita,
      note_generali: formData.note_generali,
      anno_precedente: formData.anno_precedente
    });
    setErrors({});
    setFormError(null);
    setNoPhone(false);
    // Clear phone conflicts
    setPhoneConflicts([]);
    setShowPhoneConflict(false);
    setSelectedConflictResolution(null);
  };

  // ✅ CHECK FOR PHONE CONFLICTS
  const checkPhoneConflicts = async (phone: string, currentName: string, currentSurname: string) => {
    if (!phone || phone.replace(/\D/g, '').length < 9 || isPlaceholderPhone(phone) || isShopPhone(phone)) {
      setPhoneConflicts([]);
      setShowPhoneConflict(false);
      return false;
    }

    // Skip check if we already have a cliente_id (user selected from search)
    if (formData.cliente_id) {
      setPhoneConflicts([]);
      setShowPhoneConflict(false);
      return false;
    }

    // Skip check if name/surname are not filled yet
    if (!currentName.trim() || !currentSurname.trim()) {
      setPhoneConflicts([]);
      setShowPhoneConflict(false);
      return false;
    }

    setIsCheckingPhone(true);

    try {
      const cleanPhone = normalizePhone(phone) || '';

      const { data, error } = await supabase
        .from('clienti')
        .select('id, nome, cognome, telefono, data_nascita')
        .eq('telefono', cleanPhone);

      if (error) {
        console.error('Error checking phone conflicts:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // Check if any of the results have a different name
        const conflicts = data.filter(client => {
          const nameDiffers = client.nome.toLowerCase() !== currentName.toLowerCase().trim();
          const surnameDiffers = client.cognome.toLowerCase() !== currentSurname.toLowerCase().trim();
          return nameDiffers || surnameDiffers;
        });

        if (conflicts.length > 0) {
          setPhoneConflicts(conflicts);
          setShowPhoneConflict(true);
          setSelectedConflictResolution('new'); // Default to creating new person
          return true; // Conflict found
        } else {
          // Same name and phone - will auto-match in API
          setPhoneConflicts([]);
          setShowPhoneConflict(false);
          return false;
        }
      } else {
        setPhoneConflicts([]);
        setShowPhoneConflict(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking phone conflicts:', error);
      // Don't block the user, but log the error
      setPhoneConflicts([]);
      setShowPhoneConflict(false);
      return false;
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // ✅ HANDLE SELECTING EXISTING CLIENT FROM CONFLICT
  const handleSelectConflictClient = (client: any) => {
    setFormData({
      ...formData,
      cliente_id: client.id,
      cliente_cognome: client.cognome || '',
      cliente_nome: client.nome || '',
      cliente_telefono: client.telefono || '',
    });
    setNoPhone(isPlaceholderPhone(client.telefono));
    setSelectedConflictResolution('existing');
    setShowPhoneConflict(false);
    setPhoneConflicts([]);
  };

  type CreateBustaResponse = {
    success?: boolean;
    busta?: any;
    cliente?: any;
    error?: string;
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    if (!validateForm()) {
      setFormError('Per favore correggi gli errori nei campi evidenziati');
      return;
    }

    // ✅ CHECK FOR PHONE CONFLICTS BEFORE SUBMITTING
    // Only if we're creating a new client (no cliente_id)
    if (!formData.cliente_id) {
      const hasConflict = await checkPhoneConflicts(
        noPhone ? PLACEHOLDER_PHONE : formData.cliente_telefono,
        formData.cliente_nome,
        formData.cliente_cognome
      );

      if (hasConflict) {
        // If conflict found but user hasn't made a choice yet, block submission
        if (selectedConflictResolution === null) {
          // Scroll to conflict UI
          const conflictElement = document.querySelector('[data-phone-conflict]');
          if (conflictElement) {
            conflictElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          setFormError('⚠️ Attenzione: questo numero di telefono è già associato ad un altro cliente. Scegli come procedere.');
          return;
        }

        // If user chose "existing" but didn't select a specific client, block
        if (selectedConflictResolution === 'existing' && !formData.cliente_id) {
          setFormError('⚠️ Seleziona un cliente esistente dalla lista oppure scegli "Nuova persona".');
          return;
        }

        // If user chose "new", proceed with creation (conflict acknowledged)
        // Clear the conflict state and continue
        if (selectedConflictResolution === 'new') {
          setShowPhoneConflict(false);
          setPhoneConflicts([]);
          // Continue to create new client with same phone
        }
      }
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setFormError(null);

      const response = await fetch('/api/buste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: {
            id: formData.cliente_id,  // ✅ PASSA L'ID SE CLIENTE ESISTENTE
            cognome: formData.cliente_cognome.trim(),
            nome: formData.cliente_nome.trim(),
            genere: formData.cliente_genere || null,
            telefono: (noPhone ? PLACEHOLDER_PHONE : formData.cliente_telefono.trim()),
            email: formData.cliente_email?.trim() || null,
            note_cliente: formData.cliente_note?.trim() || null
          },
          busta: {
            tipo_lavorazione: formData.tipo_lavorazione || null,
            priorita: formData.priorita,
            note_generali: formData.note_generali?.trim() || null,
            stato_attuale: 'nuove',
            anno_precedente: formData.anno_precedente,  // ✅ PASSA FLAG ANNO PRECEDENTE
            preventivo_id: preventivoId
          }
        })
      });

      const result: CreateBustaResponse = await response
        .json()
        .catch(() => ({} as CreateBustaResponse));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Errore creazione busta');
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
      cliente_id: null,  // ✅ RESET ID
      cliente_cognome: '',
      cliente_nome: '',
      cliente_genere: '',
      cliente_telefono: '',
      cliente_email: '',
      cliente_note: '',
      tipo_lavorazione: '',
      priorita: 'normale',
      note_generali: '',
      anno_precedente: false
    });
    setNoPhone(false);
    setErrors({});
    setFormError(null);
    setPreventivoId(null);
    setPreventivoUrl(null);
    setCandidati([]);
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4 kiasma-body">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white/90 rounded-2xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)] border border-emerald-200/70 p-8">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="kiasma-hero text-2xl text-[var(--ink)] mb-2">Busta Creata!</h2>
            <p className="text-slate-600 mb-6">La nuova busta è stata aggiunta al sistema</p>
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
                className="w-full px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded-lg hover:bg-black transition-colors"
              >
                Vai alla Dashboard
              </button>
              <button 
                onClick={resetForm}
                className="w-full px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
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
    <div className="w-full p-4 kiasma-body">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="kiasma-hero text-2xl text-[var(--ink)]">Nuova Busta</h1>
            {/* ✅ PULSANTE ANNULLA (se onCancel è presente) */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-white/80 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-white transition-colors"
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
            )}
          </div>
          <p className="text-slate-500 text-sm">Compila tutti i campi e clicca "Crea Busta"</p>
        </div>

        <div className="bg-white/90 rounded-2xl shadow-[0_24px_60px_-40px_rgba(0,0,0,0.4)] border border-slate-200/80 p-6">

          {/* ✅ CLIENT SEARCH SECTION */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                  <User className="w-5 h-5 mr-2 text-[var(--teal)]" />
                  Cerca Cliente Esistente
                </h2>
                <div className="mt-2 p-3 border-2 border-red-500 bg-red-50 rounded-lg">
                  <p className="text-sm font-bold text-red-800">
                    ⚠️ IMPORTANTE: Prima di creare una nuova anagrafica, verifica se il cliente è già presente nel sistema.
                    Cerca per cognome o numero di telefono per evitare duplicati.
                  </p>
                </div>
              </div>
            </div>

            {/* Search Controls */}
            <div className="bg-[var(--teal)]/5 border border-[var(--teal)]/20 rounded-lg p-4">
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
                        ? 'bg-[var(--ink)] text-[var(--paper)]'
                        : 'bg-white/80 text-slate-700 hover:bg-white'
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
                        ? 'bg-[var(--ink)] text-[var(--paper)]'
                        : 'bg-white/80 text-slate-700 hover:bg-white'
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
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40"
                  />
                  <button
                    type="button"
                    onClick={handleSearchClients}
                    disabled={isSearching || !searchValue.trim()}
                    className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                    <h3 className="text-sm font-semibold text-slate-700">
                      📋 Risultati ({searchResults.length}):
                    </h3>
                    <button
                      type="button"
                      onClick={handleNewClient}
                      className="text-sm text-[var(--teal)] hover:text-[var(--ink)] font-medium"
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
                        className="w-full text-left p-3 bg-white/80 border border-slate-200 rounded-lg hover:border-[var(--teal)]/50 hover:bg-[var(--teal)]/10 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">
                              {client.cognome} {client.nome}
                            </p>
                            <p className="text-sm text-slate-600">
                              {client.genere === 'M' ? '👨' : client.genere === 'F' ? '👩' : ''}
                              {client.telefono && ` 📞 ${formatPhoneDisplay(client.telefono)}`}
                            </p>
                          </div>
                          <span className="text-[var(--teal)]">→</span>
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
                    className="mt-2 text-sm text-[var(--teal)] hover:text-[var(--ink)] font-medium"
                  >
                    ➕ Inserisci Nuovo Cliente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cliente Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-[var(--teal)]" />
              Dati Cliente
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="cliente-cognome" className="block text-sm font-medium text-slate-700 mb-1">Cognome *</label>
                <input
                  id="cliente-cognome"
                  type="text"
                  value={formData.cliente_cognome}
                  onChange={(e) => handleInputChange('cliente_cognome', capitalizeNameProperly(e.target.value))}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40 ${
                    errors.cliente_cognome ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Rossi"
                />
                {errors.cliente_cognome && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_cognome}</p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-nome" className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input
                  id="cliente-nome"
                  type="text"
                  value={formData.cliente_nome}
                  onChange={(e) => handleInputChange('cliente_nome', capitalizeNameProperly(e.target.value))}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40 ${
                    errors.cliente_nome ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Mario"
                />
                {errors.cliente_nome && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_nome}</p>
                )}
              </div>

              {/* ✅ CAMPO GENERE */}
              <div>
                <label htmlFor="cliente-genere" className="block text-sm font-medium text-slate-700 mb-1">Genere *</label>
                <select
                  id="cliente-genere"
                  value={formData.cliente_genere}
                  onChange={(e) => handleInputChange('cliente_genere', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40 ${
                    errors.cliente_genere ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                >
                  <option value="">-- Seleziona --</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                  <option value="P.Giuridica">🏢 P.Giuridica</option>
                </select>
                {errors.cliente_genere && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_genere}</p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-telefono" className="block text-sm font-medium text-slate-700 mb-1">Telefono *</label>
                <input
                  id="cliente-telefono"
                  type="tel"
                  value={formData.cliente_telefono}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={(e) => {
                    if (noPhone) return;
                    // ✅ Format phone on blur (when user leaves field)
                    const formatted = formatPhoneDisplay(e.target.value);
                    if (formatted && formatted !== e.target.value) {
                      handlePhoneChange(formatted);
                    }
                    // ✅ Check for phone conflicts
                    checkPhoneConflicts(e.target.value, formData.cliente_nome, formData.cliente_cognome);
                  }}
                  disabled={noPhone}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40 ${
                    errors.cliente_telefono ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="347 7282793"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={noPhone}
                    onChange={(e) => {
                      const nextValue = e.target.checked;
                      setNoPhone(nextValue);
                      if (nextValue) {
                        handleInputChange('cliente_telefono', PLACEHOLDER_PHONE);
                        setErrors(prev => ({ ...prev, cliente_telefono: '' }));
                        setPhoneConflicts([]);
                        setShowPhoneConflict(false);
                        setSelectedConflictResolution(null);
                      } else if (isPlaceholderPhone(formData.cliente_telefono)) {
                        handleInputChange('cliente_telefono', '');
                      }
                    }}
                  />
                  Telefono non disponibile (usa {PLACEHOLDER_PHONE})
                </label>
                {errors.cliente_telefono && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_telefono}</p>
                )}
                {isCheckingPhone && (
                  <p className="text-[var(--teal)] text-xs mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verifica numero in corso...
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cliente-email" className="block text-sm font-medium text-slate-700 mb-1">Email (opzionale)</label>
                <input
                  id="cliente-email"
                  type="email"
                  value={formData.cliente_email}
                  onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40 ${
                    errors.cliente_email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="mario@email.com"
                />
                {errors.cliente_email && (
                  <p className="text-red-600 text-xs mt-1">{errors.cliente_email}</p>
                )}
              </div>

              {/* Note Cliente */}
              <div className="md:col-span-3">
                <label htmlFor="cliente-note" className="block text-sm font-medium text-slate-700 mb-1">Note Cliente</label>
                <textarea
                  id="cliente-note"
                  value={formData.cliente_note}
                  onChange={(e) => handleInputChange('cliente_note', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40"
                  placeholder="Note aggiuntive sul cliente..."
                />
              </div>

              {/* ✅ PHONE CONFLICT DISAMBIGUATION UI */}
              {showPhoneConflict && phoneConflicts.length > 0 && (
                <div className="md:col-span-3" data-phone-conflict>
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-amber-900 mb-2">
                          📞 Questo numero è già associato a:
                        </h3>
                        <ul className="mb-3 space-y-1">
                          {phoneConflicts.map((client) => (
                            <li key={client.id} className="text-sm text-amber-800">
                              • {client.cognome} {client.nome}
                              {client.data_nascita && (
                                <span className="text-amber-600 ml-2">
                                  (nato il {new Date(client.data_nascita).toLocaleDateString('it-IT')})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        <div className="bg-white rounded-lg p-3 border border-amber-300">
                          <p className="text-sm font-medium text-slate-700 mb-3">
                            Stai creando la busta per: <strong>{formData.cliente_cognome} {formData.cliente_nome}</strong>
                          </p>

                          <div className="space-y-2">
                            {/* Option 1: New person (default) */}
                            <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--teal)]/10 bg-[var(--teal)]/10 border-[var(--teal)]/60">
                              <input
                                type="radio"
                                name="conflict-resolution"
                                value="new"
                                checked={selectedConflictResolution === 'new'}
                                onChange={() => setSelectedConflictResolution('new')}
                                className="mt-1 w-4 h-4 text-[var(--teal)]"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">
                                  ✅ Nuova persona (collegata a questo contatto)
                                </div>
                                <div className="text-sm text-slate-600 mt-1">
                                  Crea un nuovo cliente "{formData.cliente_cognome} {formData.cliente_nome}" con lo stesso numero di telefono.
                                  Utile per familiari o caregiver che condividono il numero.
                                </div>
                              </div>
                            </label>

                            {/* Option 2: Select existing person */}
                            <div className="border-2 border-slate-200 rounded-lg p-3 bg-white/70">
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name="conflict-resolution"
                                  value="existing"
                                  checked={selectedConflictResolution === 'existing'}
                                  onChange={() => setSelectedConflictResolution('existing')}
                                  className="mt-1 w-4 h-4 text-[var(--teal)]"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">
                                    Seleziona una persona esistente
                                  </div>
                                  <div className="text-sm text-slate-600 mt-1 mb-2">
                                    La busta verrà creata per una delle persone già presenti nel sistema.
                                  </div>
                                </div>
                              </label>

                              {selectedConflictResolution === 'existing' && (
                                <div className="ml-7 mt-2 space-y-2">
                                  {phoneConflicts.map((client) => (
                                    <button
                                      key={client.id}
                                      type="button"
                                      onClick={() => handleSelectConflictClient(client)}
                                      className="w-full text-left p-2 bg-white/80 border border-slate-200 rounded hover:bg-[var(--teal)]/10 hover:border-[var(--teal)]/40 transition-colors"
                                    >
                                      <div className="font-medium text-slate-900">
                                        {client.cognome} {client.nome}
                                      </div>
                                      {client.data_nascita && (
                                        <div className="text-xs text-slate-600">
                                          Nato il {new Date(client.data_nascita).toLocaleDateString('it-IT')}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <hr className="my-6 border-slate-200" />

          {/* Lavorazione Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-[var(--teal)]" />
              Dettagli Lavorazione
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tipo-lavorazione" className="block text-sm font-medium text-slate-700 mb-1">Tipo Lavorazione</label>
                <select
                  id="tipo-lavorazione"
                  value={formData.tipo_lavorazione}
                  onChange={(e) => handleInputChange('tipo_lavorazione', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40"
                >
                  <option value="">-- Seleziona --</option>
                  <option value="OCV">👓 OCV - Occhiale completo</option>
                  <option value="OV">👓 OV - Montatura</option>
                  <option value="OS">🕶️ OS - Occhiale sole</option>
                  <option value="LV">🔍 LV - Lenti vista</option>
                  <option value="LS">🌅 LS - Lenti sole</option>
                  <option value="LAC">👁️ LAC - Lenti contatto</option>
                  <option value="TALAC">👁️ TALAC - Training Applicativo LAC</option>
                  <option value="ACC">🔧 ACC - Accessori</option>
                  <option value="RIC">🔄 RIC - Ricambio</option>
                  <option value="LAB">🧪 LAB - Laboratorio</option>
                  <option value="SA">📐 SA - Sostituzione anticipata</option>
                  <option value="SG">🧵 SG - Sostituzione in Garanzia</option>
                  <option value="CT">👁️ CT - Controllo tecnico</option>
                  <option value="BR">🎁 BR - Buono Regalo</option>
                  <option value="SPRT">🚴 SPRT - Sport</option>
                  <option value="ES">🔬 ES - Esercizi oculari</option>
                  <option value="REL">📋 REL - Relazione</option>
                  <option value="FT">🧾 FT - Fattura</option>
                  <option value="VFT">🔍 VFT - Verifica Fattibilità Tecnica</option>
                  <option value="VC">👁️ VC - Visita Controllo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priorità</label>
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
                          : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                        }
                      `}
                    >
                      {priority.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preventivo di partenza */}
              {preventiviMostrati.length > 0 && (
                <div className="md:col-span-2 rounded-lg border-2 border-emerald-300 bg-emerald-50/60 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    Questa busta nasce da un preventivo? <span className="font-normal text-slate-600">(facoltativo)</span>
                  </p>
                  <ul className="space-y-2">
                    {preventiviMostrati.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-emerald-200 bg-white p-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={preventivoId === p.id}
                            onChange={() => setPreventivoId(preventivoId === p.id ? null : p.id)}
                          />
                          <span>
                            <strong>{p.numero_label}</strong> · {p.cliente_cognome} {p.cliente_nome} · {formatDataIt(p.data_stipula)} ·{' '}
                            {importoPreventivo(p)}{' '}
                            <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-medium ${ESITI[p.esito as keyof typeof ESITI]?.badge ?? ''}`}>
                              {ESITI[p.esito as keyof typeof ESITI]?.label ?? p.esito}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-600">
                    Spuntandolo, il preventivo viene collegato alla busta e segnato come approvato.
                  </p>
                </div>
              )}

              {/* ✅ ANNO BUSTA */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.anno_precedente}
                    onChange={(e) => setFormData(prev => ({ ...prev, anno_precedente: e.target.checked }))}
                    className="w-5 h-5 text-[var(--teal)] border-slate-300 rounded focus:ring-2 focus:ring-[var(--teal)]/30"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-900">
                      📅 Busta anno precedente (2025)
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Seleziona questa opzione se stai inserendo una busta relativa all'anno 2025.
                      {formData.anno_precedente
                        ? ' Il numero busta inizierà con "25-"'
                        : ' Lascia deselezionato per buste 2026 (numero inizierà con "26-")'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="note-generali" className="block text-sm font-medium text-slate-700 mb-1">Note Generali</label>
                <textarea
                  id="note-generali"
                  value={formData.note_generali}
                  onChange={(e) => handleInputChange('note_generali', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-[var(--teal)]/40"
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
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center px-6 py-3 bg-[var(--ink)] text-[var(--paper)] rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
