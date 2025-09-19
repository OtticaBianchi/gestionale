// ===== FILE: buste/[id]/_components/tabs/AnagraficaTab.tsx =====

'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { mutate } from 'swr';
import { 
  User, 
  Calendar, 
  Package, 
  Edit3, 
  Save, 
  X,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Eye // ✅ AGGIUNTO per banner read-only
} from 'lucide-react';
import PrintBustaButton from 'src/app/dashboard/_components/PrintBustaButton'; // ✅ IMPORT AGGIUNTO
import { useUser } from '@/context/UserContext';

// ===== TYPES LOCALI =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
  payment_plan?: (Database['public']['Tables']['payment_plans']['Row'] & {
    payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
  }) | null;
  info_pagamenti?: Pick<
    Database['public']['Tables']['info_pagamenti']['Row'],
    'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'data_saldo' | 'updated_at'
  > | null;
};

type GenereCliente = 'M' | 'F' | null;

// Tipi props
interface AnagraficaTabProps {
  busta: BustaDettagliata;
  onBustaUpdate: (updatedBusta: BustaDettagliata) => void;
  isReadOnly?: boolean; // ✅ AGGIUNTO
}

export default function AnagraficaTab({ busta, onBustaUpdate, isReadOnly = false }: AnagraficaTabProps) {
  // ===== STATE =====
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // User context for role checking
  const { profile } = useUser();
  
  // ✅ AGGIUNTO: Helper per controlli
  const canEdit = !isReadOnly;
  
  const [editForm, setEditForm] = useState({
    // ✅ Dati busta
    tipo_lavorazione: busta.tipo_lavorazione || '',
    priorita: busta.priorita,
    note_generali: busta.note_generali || '',
    is_suspended: busta.is_suspended,
    // ✅ Dati cliente - INCLUSO NUOVO CAMPO GENERE
    cliente_nome: busta.clienti?.nome || '',
    cliente_cognome: busta.clienti?.cognome || '',
    cliente_data_nascita: busta.clienti?.data_nascita || '',
    cliente_genere: busta.clienti?.genere || null as GenereCliente,  // ✅ NUOVO CAMPO
    cliente_telefono: busta.clienti?.telefono || '',
    cliente_email: busta.clienti?.email || '',
    cliente_note: busta.clienti?.note_cliente || '',
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== UTILITY FUNCTIONS =====
  const shouldShowTipoLenti = () => {
    const tipoLav = editForm.tipo_lavorazione || busta.tipo_lavorazione;
    return tipoLav === 'OCV' || tipoLav === 'LV';
  };

  // ===== SAVE FUNCTION =====
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // ✅ Validazione dati cliente
      if (!editForm.cliente_nome.trim() || !editForm.cliente_cognome.trim()) {
        throw new Error("Nome e cognome sono obbligatori");
      }

      // ✅ Gestione tipo_lavorazione
      const validWorkTypes = [
        'OCV', 'OV', 'OS', 'LV', 'LS', 'LAC', 'ACC', 'RIC', 'RIP', 
        'SA', 'SG', 'CT', 'ES', 'REL', 'FT', 'SPRT'
      ] as const;
      
      let tipoLavorazioneValue: Database['public']['Enums']['work_type'] | null = null;
      
      if (editForm.tipo_lavorazione && editForm.tipo_lavorazione.trim() !== '') {
        if (validWorkTypes.includes(editForm.tipo_lavorazione as any)) {
          tipoLavorazioneValue = editForm.tipo_lavorazione as Database['public']['Enums']['work_type'];
        } else {
          throw new Error(`Tipo lavorazione non valido: ${editForm.tipo_lavorazione}`);
        }
      }

      console.log('🔍 Saving busta and client data...');

      // ✅ FIX: Aggiorna prima il cliente (se esiste) - INCLUSO GENERE
      if (busta.clienti && busta.cliente_id) {
        const { error: clientError } = await supabase
          .from('clienti')
          .update({
            nome: editForm.cliente_nome.trim(),
            cognome: editForm.cliente_cognome.trim(),
            data_nascita: editForm.cliente_data_nascita || null,
            genere: editForm.cliente_genere,  // ✅ NUOVO CAMPO
            telefono: editForm.cliente_telefono.trim() || null,
            email: editForm.cliente_email.trim() || null,
            note_cliente: editForm.cliente_note.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', busta.cliente_id);

        if (clientError) {
          console.error('❌ Client update error:', clientError);
          throw new Error(`Errore aggiornamento cliente: ${clientError.message}`);
        }
      }

      // ✅ Aggiorna la busta
      const { error: bustaError } = await supabase
        .from('buste')
        .update({
          tipo_lavorazione: tipoLavorazioneValue,
          priorita: editForm.priorita,
          note_generali: editForm.note_generali.trim() || null,
          is_suspended: editForm.is_suspended,
          updated_at: new Date().toISOString()
        })
        .eq('id', busta.id);

      if (bustaError) {
        console.error('❌ Busta update error:', bustaError);
        throw new Error(`Errore aggiornamento busta: ${bustaError.message}`);
      }

      console.log('✅ Busta and client updated successfully');

      // ✅ Aggiorna lo stato locale
      const updatedBusta = {
        ...busta,
        tipo_lavorazione: tipoLavorazioneValue,
        priorita: editForm.priorita,
        note_generali: editForm.note_generali.trim() || null,
        is_suspended: editForm.is_suspended,
        updated_at: new Date().toISOString(),
        clienti: busta.clienti ? {
          ...busta.clienti,
          nome: editForm.cliente_nome.trim(),
          cognome: editForm.cliente_cognome.trim(),
          data_nascita: editForm.cliente_data_nascita || null,
          genere: editForm.cliente_genere,  // ✅ NUOVO CAMPO
          telefono: editForm.cliente_telefono.trim() || null,
          email: editForm.cliente_email.trim() || null,
          note_cliente: editForm.cliente_note.trim() || null,
        } : null
      };

      onBustaUpdate(updatedBusta);

      // ✅ SWR: Invalidate cache after busta update
      await mutate('/api/buste');

      // ✅ SUCCESS
      setSaveSuccess(true);
      setIsEditing(false);

      // Reset success message dopo 3 secondi
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Errore nel salvataggio:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      tipo_lavorazione: busta.tipo_lavorazione || '',
      priorita: busta.priorita,
      note_generali: busta.note_generali || '',
      is_suspended: busta.is_suspended,
      cliente_nome: busta.clienti?.nome || '',
      cliente_cognome: busta.clienti?.cognome || '',
      cliente_data_nascita: busta.clienti?.data_nascita || '',
      cliente_genere: busta.clienti?.genere || null,  // ✅ NUOVO CAMPO
      cliente_telefono: busta.clienti?.telefono || '',
      cliente_email: busta.clienti?.email || '',
      cliente_note: busta.clienti?.note_cliente || '',
    });
    setIsEditing(false);
    setSaveSuccess(false);
  };

  // ===== RENDER =====
  return (
    <div className="space-y-6">
      
      {/* ✅ READ-ONLY BANNER - NUOVO */}
      {isReadOnly && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Modalità Sola Visualizzazione</h3>
              <p className="text-sm text-orange-700">
                Come operatore puoi visualizzare i dettagli ma non effettuare modifiche.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Modifiche salvate con successo!</span>
        </div>
      )}

      {/* Informazioni Cliente - ORA MODIFICABILI CON GENERE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-500" />
            Informazioni Cliente
          </h2>
          
          <div className="flex items-center space-x-2">
            {/* ✅ PULSANTE STAMPA - SEMPRE VISIBILE */}
            {busta.clienti && (
              <PrintBustaButton
                bustaData={{
                  readable_id: busta.readable_id,
                  cliente_nome: busta.clienti.nome,
                  cliente_cognome: busta.clienti.cognome,
                  tipo_lavorazione: busta.tipo_lavorazione,
                  data_apertura: busta.data_apertura
                }}
                size="sm"
              />
            )}
            
            {/* ✅ MODIFICA: Indicatore modalità editing - SOLO SE canEdit */}
            {canEdit && isEditing && (
              <span className="text-sm text-blue-600 font-medium">Ora modificabile!</span>
            )}
          </div>
        </div>
        
        {busta.clienti ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Nome *</label>
              {canEdit && isEditing ? (
                <input
                  type="text"
                  value={editForm.cliente_nome}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_nome: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              ) : (
                <p className="text-lg font-medium text-gray-900">{busta.clienti.nome}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-500">Cognome *</label>
              {canEdit && isEditing ? (
                <input
                  type="text"
                  value={editForm.cliente_cognome}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_cognome: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              ) : (
                <p className="text-lg font-medium text-gray-900">{busta.clienti.cognome}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-500">Data di Nascita</label>
              {canEdit && isEditing ? (
                <input
                  type="date"
                  value={editForm.cliente_data_nascita}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_data_nascita: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">
                  {busta.clienti.data_nascita ? 
                    new Date(busta.clienti.data_nascita).toLocaleDateString('it-IT') : 
                    'Non specificata'
                  }
                </p>
              )}
            </div>

            {/* ✅ NUOVO CAMPO GENERE */}
            <div>
              <label className="block text-sm font-medium text-gray-500">Genere</label>
              {canEdit && isEditing ? (
                <select
                  value={editForm.cliente_genere || ''}
                  onChange={(e) => setEditForm(prev => ({ 
                    ...prev, 
                    cliente_genere: e.target.value === '' ? null : e.target.value as GenereCliente 
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Non specificato</option>
                  <option value="M">👨 Maschio</option>
                  <option value="F">👩 Femmina</option>
                </select>
              ) : (
                <p className="text-gray-900">
                  {busta.clienti.genere === 'M' ? '👨 Maschio' : 
                   busta.clienti.genere === 'F' ? '👩 Femmina' : 
                   'Non specificato'}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-500">Telefono</label>
              {canEdit && isEditing ? (
                <input
                  type="tel"
                  value={editForm.cliente_telefono}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="333 123 4567"
                />
              ) : (
                busta.clienti.telefono ? (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-900">{busta.clienti.telefono}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Non specificato</p>
                )
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              {canEdit && isEditing ? (
                <input
                  type="email"
                  value={editForm.cliente_email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              ) : (
                busta.clienti.email ? (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-900">{busta.clienti.email}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Non specificata</p>
                )
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500">Note Cliente</label>
              {canEdit && isEditing ? (
                <textarea
                  value={editForm.cliente_note}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cliente_note: e.target.value }))}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Note aggiuntive sul cliente..."
                />
              ) : (
                <p className="text-gray-900 text-sm">
                  {busta.clienti.note_cliente || 'Nessuna nota'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 italic">Informazioni cliente non disponibili</p>
        )}
      </div>

      {/* Dettagli Lavorazione */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-gray-500" />
            Dettagli Lavorazione
          </h2>
          
          {/* ✅ MODIFICA: PULSANTE MODIFICA - NASCOSTO PER OPERATORI */}
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              <span>Modifica</span>
            </button>
          )}
          
          {/* ✅ MODIFICA: PULSANTI SALVA/ANNULLA - SOLO SE canEdit E isEditing */}
          {canEdit && isEditing && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salva</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Annulla</span>
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Tipo Lavorazione</label>
            {canEdit && isEditing ? (
              <select
                value={editForm.tipo_lavorazione}
                onChange={(e) => setEditForm(prev => ({ ...prev, tipo_lavorazione: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">-- Da specificare --</option>
                <option value="OCV">👓 OCV - Occhiale da vista completo</option>
                <option value="OV">👓 OV - Montatura</option>
                <option value="OS">🕶️ OS - Occhiale da sole</option>
                <option value="LV">🔍 LV - Lenti da vista</option>
                <option value="LS">🌅 LS - Lenti da sole</option>
                <option value="LAC">👁️ LAC - Lenti a contatto</option>
                <option value="ACC">🔧 ACC - Accessori</option>
                <option value="RIC">🔄 RIC - Ricambio</option>
                <option value="RIP">🔨 RIP - Riparazione</option>
                <option value="SA">📐 SA - Sostituzione Anticipata</option>
                <option value="SG">🧵 SG - Sostituzione in garanzia</option>
                <option value="CT">👁️ CT - Controllo tecnico</option>
                <option value="ES">🔬 ES - Esercizi oculari</option>
                <option value="REL">📋 REL - Relazione</option>
                <option value="FT">🧾 FT - Fattura</option>
                <option value="SPRT">🚴 SPRT - Sport</option>
                </select>
            ) : (
              <p className="text-gray-900">{busta.tipo_lavorazione || 'Da specificare'}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-500">Priorità</label>
            {canEdit && isEditing ? (
              <select
                value={editForm.priorita}
                onChange={(e) => setEditForm(prev => ({ ...prev, priorita: e.target.value as any }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
                <option value="critica">Critica</option>
              </select>
            ) : (
              <p className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                busta.priorita === 'critica' ? 'bg-red-100 text-red-800' :
                busta.priorita === 'urgente' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {busta.priorita.charAt(0).toUpperCase() + busta.priorita.slice(1)}
              </p>
            )}
          </div>
          
          {canEdit && isEditing && (
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editForm.is_suspended}
                  onChange={(e) => setEditForm(prev => ({ ...prev, is_suspended: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                  Busta sospesa
                </span>
              </label>
            </div>
          )}
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-500">Note Generali</label>
            {canEdit && isEditing ? (
              <textarea
                value={editForm.note_generali}
                onChange={(e) => setEditForm(prev => ({ ...prev, note_generali: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Note sulla lavorazione..."
              />
            ) : (
              <p className="text-gray-900 text-sm">
                {busta.note_generali || 'Nessuna nota'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
