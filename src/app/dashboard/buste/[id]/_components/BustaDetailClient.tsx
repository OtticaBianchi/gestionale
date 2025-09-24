// app/dashboard/buste/[id]/_components/BustaDetailClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { useBuste } from '@/hooks/useBuste';
import { 
  User, 
  Calendar, 
  Package, 
  Clock, 
  FileText, 
  Edit3, 
  Save, 
  X,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShoppingCart,
  Plus,
  Truck,
  Factory,
  Eye,
  Trash2,
  MessageCircle,
  CreditCard
} from 'lucide-react';

// Import dei componenti estratti
import AnagraficaTab from './tabs/AnagraficaTab';
import MaterialiTab from './tabs/MaterialiTab';
import LavorazioneTab from './tabs/LavorazioneTab';
import NotificheTab from './tabs/NotificheTab';
import PagamentoTab from './tabs/PagamentoTab';
import BustaInfoSidebar from './shared/BustaInfoSidebar';
import QuickAddErrorForm from '@/components/error-tracking/QuickAddErrorForm';

type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
  ordini_materiali?: Array<{
    id: string;
    descrizione_prodotto: string;
    stato: string;
  }>;
  payment_plan?: (Database['public']['Tables']['payment_plans']['Row'] & {
    payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
  }) | null;
  info_pagamenti?: Pick<
    Database['public']['Tables']['info_pagamenti']['Row'],
    'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'data_saldo' | 'updated_at'
  > | null;
};

interface BustaDetailClientProps {
  busta: BustaDettagliata;
}

export default function BustaDetailClient({ busta: initialBusta }: BustaDetailClientProps) {
  // ===== SWR INTEGRATION =====
  const { data: busteData } = useBuste();
  
  // ✅ Find current busta from SWR data and update only stato_attuale
  const swrBusta = busteData?.find(b => b.id === initialBusta.id);
  
  // ✅ Use SWR data only to sync stato_attuale, keep full detail structure
  const [busta, setBusta] = useState(initialBusta);
  const [activeTab, setActiveTab] = useState('anagrafica');
  
  // ✅ Update only stato_attuale when SWR data changes
  useEffect(() => {
    if (swrBusta && swrBusta.stato_attuale !== busta.stato_attuale) {
      console.log('🔄 Updating busta state from SWR:', swrBusta.stato_attuale);
      setBusta(prevBusta => ({
        ...prevBusta,
        stato_attuale: swrBusta.stato_attuale,
        updated_at: swrBusta.updated_at
      }));
    }
  }, [swrBusta, busta.stato_attuale]);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Error tracking modal state
  const [showErrorForm, setShowErrorForm] = useState(false);

  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== CHECK USER ROLE =====
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setUserRole(profile?.role || null);
      }
    };
    
    checkUserRole();
  }, []);

  // ===== DELETE BUSTA FUNCTIONS =====
  const handleDeleteBusta = async () => {
    setIsDeleting(true);
    
    try {
      console.log('🗑️ Cancellazione busta:', busta.id);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");
      
      // ✅ Chiama la funzione database per eliminare completamente la busta
      const { data, error } = await supabase.rpc('delete_busta_completa', {
        busta_uuid: busta.id
      });
      
      if (error) {
        console.error('❌ Errore database:', error);
        throw new Error(error.message);
      }
      
      if (!data) {
        throw new Error('Errore durante la cancellazione della busta');
      }
      
      console.log('✅ Busta cancellata con successo');
      
      // ✅ SWR: Invalidate cache after deletion
      await mutate('/api/buste');
      
      router.push('/dashboard');
      router.refresh();
      
    } catch (error: any) {
      console.error('❌ Errore cancellazione busta:', error);
      alert(`Errore nella cancellazione: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteStep(1);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
    } else if (deleteStep === 2) {
      handleDeleteBusta();
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
  };

  // ===== TAB NAVIGATION =====
  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica & Lavorazione', icon: User },
    { id: 'materiali', label: 'Materiali & Ordini', icon: ShoppingCart },
    { id: 'lavorazione', label: 'Lavorazione', icon: Factory },
    { id: 'notifiche', label: 'Notifiche & Ritiro', icon: MessageCircle },
    { id: 'pagamento', label: 'Pagamento & Consegna', icon: CreditCard }
  ];

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
      {/* ===== DELETE MODAL - SOLO PER ADMIN ===== */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2 rounded-full ${deleteStep === 1 ? 'bg-orange-100' : 'bg-red-100'}`}>
                  {deleteStep === 1 ? (
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  ) : (
                    <Trash2 className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {deleteStep === 1 ? 'Conferma Cancellazione' : 'ATTENZIONE: Cancellazione Definitiva'}
                </h3>
              </div>

              {deleteStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Stai per cancellare la busta <strong>#{busta.readable_id}</strong> di{' '}
                    <strong>{busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : 'Cliente sconosciuto'}</strong>.
                  </p>
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <p className="text-sm text-orange-800">
                      <strong>Questa azione eliminerà:</strong>
                    </p>
                    <ul className="text-sm text-orange-700 mt-1 space-y-1">
                      <li>• Tutti gli ordini materiali associati</li>
                      <li>• La cronologia degli stati</li>
                      <li>• Tutte le note e comunicazioni</li>
                      <li>• I dati della busta</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-500">
                    I dati del cliente rimarranno salvati per future buste.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-800 font-medium mb-2">
                      ⚠️ ULTIMA CONFERMA RICHIESTA
                    </p>
                    <p className="text-red-700 text-sm">
                      Questa operazione è <strong>IRREVERSIBILE</strong>. 
                      Una volta confermata, tutti i dati della busta #{busta.readable_id} 
                      saranno persi definitivamente.
                    </p>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Sei sicuro di voler procedere con la cancellazione definitiva?
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className={`
                    px-4 py-2 rounded-md transition-colors flex items-center space-x-2 disabled:opacity-50
                    ${deleteStep === 1 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-red-600 text-white hover:bg-red-700'
                    }
                  `}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cancellazione...</span>
                    </>
                  ) : (
                    <>
                      {deleteStep === 1 ? (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          <span>Continua</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Cancella Definitivamente</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Busta */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Package className="w-7 h-7 mr-3 text-blue-600" />
                Busta #{busta.readable_id}
              </h1>
              <p className="text-gray-600 mt-1">
                {busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : 'Cliente non specificato'}
              </p>
            </div>
            <div className="text-right flex items-center space-x-4">
              <div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  busta.priorita === 'critica' ? 'bg-red-100 text-red-800' :
                  busta.priorita === 'urgente' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {busta.priorita.charAt(0).toUpperCase() + busta.priorita.slice(1)}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Stato: {busta.stato_attuale.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {/* ===== PULSANTE SEGNALA ERRORE - PER MANAGER/ADMIN ===== */}
                {(userRole === 'admin' || userRole === 'manager') && (
                  <button
                    onClick={() => setShowErrorForm(true)}
                    className="flex items-center space-x-2 px-3 py-2 bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors border border-orange-200 shadow-sm"
                    title="Segnala errore su questa busta"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Segnala Errore</span>
                  </button>
                )}

                {/* ===== PULSANTE DELETE - SOLO PER ADMIN ===== */}
                {userRole === 'admin' && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors border border-red-200 shadow-sm"
                    title="Cancella busta (solo amministratore)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Elimina</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content - CORREZIONE LAYOUT */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Area principale tabs - 2/3 dello spazio */}
          <div className="lg:col-span-2">
            {activeTab === 'anagrafica' && (
              <AnagraficaTab 
                busta={busta} 
                onBustaUpdate={(updatedBusta) => {
                  setBusta(updatedBusta);
                  // SWR cache will be updated by the tab component
                }}
                isReadOnly={userRole === 'operatore'} // ✅ AGGIUNTO
              />
            )}

            {activeTab === 'materiali' && (
              <MaterialiTab 
                busta={busta}
                isReadOnly={userRole === 'operatore'}
                canDelete={userRole === 'admin'}
              />
            )}

            {activeTab === 'lavorazione' && (
              <LavorazioneTab 
                busta={busta}
                isReadOnly={userRole === 'operatore'} // ✅ AGGIUNTO
              />
            )}

            {activeTab === 'notifiche' && (
              <NotificheTab 
                busta={busta}
                isReadOnly={userRole === 'operatore'} // ✅ AGGIUNTO
              />
            )}

            {activeTab === 'pagamento' && (
              <PagamentoTab 
                busta={busta}
                isReadOnly={userRole === 'operatore'} // ✅ AGGIUNTO
              />
            )}
          </div>

          {/* Sidebar Globale - 1/3 dello spazio - SEMPRE VISIBILE */}
          <div className="lg:col-span-1">
            <BustaInfoSidebar busta={busta} />
          </div>

        </div>
      </div>

      {/* Error Tracking Modal */}
      <QuickAddErrorForm
        isOpen={showErrorForm}
        onClose={() => setShowErrorForm(false)}
        onSuccess={() => {
          setShowErrorForm(false);
          // Optionally refresh data or show success message
        }}
        prefilledBustaId={busta.id}
        prefilledClienteId={busta.clienti?.id}
      />
    </div>
  );
}
