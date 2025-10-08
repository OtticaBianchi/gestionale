// app/modules/operations/page.tsx - Gestione Ordini (Manager/Admin)
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/context/UserContext'
import { useRouter } from 'next/navigation'
import {
  Package,
  Truck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Globe,
  Phone,
  Mail,
  User,
  Calendar,
  ExternalLink,
  Loader2,
  Filter,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/types/database.types'
import { createBrowserClient } from '@supabase/ssr'

// ===== TYPES =====
type Cliente = {
  id: string
  nome: string
  cognome: string
  telefono: string | null
}

type BustaRef = {
  id: string
  readable_id: string
  stato_attuale: string
  tipo_lavorazione: Database['public']['Enums']['work_type'] | null
  clienti: Cliente | null
}

type OrdineEnhanced = {
  id: string
  busta_id: string
  descrizione_prodotto: string
  stato: 'da_ordinare' | 'ordinato' | 'in_arrivo' | 'in_ritardo' | 'consegnato' | 'accettato_con_riserva' | 'rifiutato'
  da_ordinare: boolean | null
  data_ordine: string | null
  data_consegna_prevista: string | null
  data_consegna_effettiva: string | null
  note: string | null
  created_at: string
  giorni_ritardo: number | null
  buste: BustaRef

  // Enhanced fornitore data
  fornitore_nome: string | null
  fornitore_tipo: 'lenti' | 'lac' | 'montature' | 'sport' | 'lab_esterno' | null
  fornitore_telefono: string | null
  fornitore_email: string | null
  fornitore_web_address: string | null
  fornitore_note: string | null
  fornitore_tempi_medi: number | null

  // Calculated fields
  giorni_aperti: number
  priorita: 'normale' | 'urgente'
}

type FornitoreGroup = {
  nome: string
  tipo: 'lenti' | 'lac' | 'montature' | 'sport' | 'lab_esterno'
  telefono: string | null
  email: string | null
  web_address: string | null
  note: string | null
  tempi_medi: number | null
  metodo_ordine: 'portale' | 'email' | 'telefono' | 'misto'
  ordini: OrdineEnhanced[]
}

const tabs = [
  { key: 'da_ordinare', label: 'Da ordinare', icon: Package, color: 'blue' },
  { key: 'ordinato', label: 'Ordinati', icon: CheckCircle, color: 'green' },
  { key: 'in_arrivo', label: 'In arrivo', icon: Truck, color: 'purple' },
  { key: 'in_ritardo', label: 'In ritardo', icon: AlertTriangle, color: 'red' },
  { key: 'all', label: 'Tutti', icon: Search, color: 'gray' },
] as const

export default function GestioneOrdiniPage() {
  const { user, profile, isLoading } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['key']>('da_ordinare')
  const [loading, setLoading] = useState(false)
  const [ordini, setOrdini] = useState<OrdineEnhanced[]>([])
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped')
  const [collapsedSuppliers, setCollapsedSuppliers] = useState(new Set<string>())
  const [selectedOrders, setSelectedOrders] = useState(new Set<string>())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/login?redirectTo=/modules/operations')
      else if (profile?.role !== 'admin' && profile?.role !== 'manager') router.push('/dashboard?error=manager_required')
    }
  }, [user, profile, isLoading, router])

  const fetchOrdiniEnhanced = async () => {
    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('ordini_materiali')
        .select(`
          id,
          busta_id,
          descrizione_prodotto,
          stato,
          da_ordinare,
          data_ordine,
          data_consegna_prevista,
          data_consegna_effettiva,
          note,
          created_at,
          giorni_ritardo,

          buste!inner(
            id,
            readable_id,
            stato_attuale,
            tipo_lavorazione,
            clienti!inner(id, nome, cognome, telefono)
          ),

          fornitori_lenti(nome, telefono, email, web_address, note, tempi_consegna_medi),
          fornitori_lac(nome, telefono, email, web_address, note, tempi_consegna_medi),
          fornitori_montature(nome, telefono, email, web_address, note, tempi_consegna_medi),
          fornitori_sport(nome, telefono, email, web_address, note, tempi_consegna_medi),
          fornitori_lab_esterno(nome, telefono, email, web_address, note, tempi_consegna_medi)
        `)

      // Apply filters based on active tab
      if (activeTab !== 'all') {
        if (activeTab === 'da_ordinare') {
          query = query.eq('da_ordinare', true)
        } else {
          query = query.eq('stato', activeTab)
        }
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('❌ Errore query ordini:', error)
        throw error
      }

      // Normalize supplier data and calculate fields
      const ordiniEnhanced: OrdineEnhanced[] = (data || []).map(ordine => {
        // Determine active supplier
        let fornitore_nome: string | null = null
        let fornitore_tipo: 'lenti' | 'lac' | 'montature' | 'sport' | 'lab_esterno' | null = null
        let fornitore_telefono: string | null = null
        let fornitore_email: string | null = null
        let fornitore_web_address: string | null = null
        let fornitore_note: string | null = null
        let fornitore_tempi_medi: number | null = null

        const suppliers = [
          { data: ordine.fornitori_lenti, type: 'lenti' as const },
          { data: ordine.fornitori_lac, type: 'lac' as const },
          { data: ordine.fornitori_montature, type: 'montature' as const },
          { data: ordine.fornitori_sport, type: 'sport' as const },
          { data: ordine.fornitori_lab_esterno, type: 'lab_esterno' as const },
        ]

        for (const supplier of suppliers) {
          if (supplier.data?.nome) {
            fornitore_nome = supplier.data.nome
            fornitore_tipo = supplier.type
            fornitore_telefono = supplier.data.telefono
            fornitore_email = supplier.data.email
            fornitore_web_address = supplier.data.web_address
            fornitore_note = supplier.data.note
            fornitore_tempi_medi = supplier.data.tempi_consegna_medi
            break
          }
        }

        // Calculate days since creation
        const giorniAperti = ordine.created_at
          ? Math.floor((Date.now() - new Date(ordine.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        return {
          ...ordine,
          created_at: ordine.created_at || '',
          fornitore_nome,
          fornitore_tipo,
          fornitore_telefono,
          fornitore_email,
          fornitore_web_address,
          fornitore_note,
          fornitore_tempi_medi,
          giorni_aperti: giorniAperti,
          priorita: giorniAperti > 5 ? 'urgente' : 'normale'
        } as OrdineEnhanced
      })

      setOrdini(ordiniEnhanced)
    } catch (e: any) {
      setError(e.message)
      setOrdini([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && profile?.role && (profile.role === 'admin' || profile.role === 'manager')) {
      fetchOrdiniEnhanced()
    }
  }, [activeTab, user, profile])

  // Group orders by supplier for grouped view
  const ordiniPerFornitore = useMemo(() => {
    const groups: Record<string, FornitoreGroup> = {}

    ordini.forEach(ordine => {
      const nomeFornitore = ordine.fornitore_nome || 'FORNITORE NON SPECIFICATO'

      if (!groups[nomeFornitore]) {
        groups[nomeFornitore] = {
          nome: nomeFornitore,
          tipo: ordine.fornitore_tipo || 'lenti',
          telefono: ordine.fornitore_telefono,
          email: ordine.fornitore_email,
          web_address: ordine.fornitore_web_address,
          note: ordine.fornitore_note,
          tempi_medi: ordine.fornitore_tempi_medi,
          metodo_ordine: ordine.fornitore_web_address ? 'portale' : (
            ordine.fornitore_email && ordine.fornitore_telefono ? 'misto' :
            ordine.fornitore_email ? 'email' : 'telefono'
          ),
          ordini: []
        }
      }

      groups[nomeFornitore].ordini.push(ordine)
    })

    return groups
  }, [ordini])

  // Bulk operations
  const markSelectedAsOrdered = async () => {
    if (selectedOrders.size === 0) return

    const confirmed = confirm(`Confermi di aver ordinato ${selectedOrders.size} materiali?`)
    if (!confirmed) return

    setBulkUpdating(true)
    try {
      const oggi = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('ordini_materiali')
        .update({
          da_ordinare: false,
          stato: 'ordinato',
          data_ordine: oggi,
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedOrders))

      if (error) throw error

      await fetchOrdiniEnhanced()
      setSelectedOrders(new Set())
    } catch (error: any) {
      setError(error.message)
    } finally {
      setBulkUpdating(false)
    }
  }

  // Single order operations - Open supplier portal to place actual order
  const openSupplierPortal = (ordine: OrdineEnhanced) => {
    console.log('🌐 Opening supplier portal for order:', ordine.id)

    // Use real supplier URL if available, otherwise mock URL
    const supplierUrl = ordine.fornitore_web_address ||
      `https://mock-supplier-portal.com/order?product=${encodeURIComponent(ordine.descrizione_prodotto)}&ref=${ordine.buste.readable_id}`

    // Open in new tab
    window.open(supplierUrl, '_blank', 'noopener,noreferrer')

    console.log('🔗 Opened supplier portal:', supplierUrl)
  }

  const markArrivato = async (ordine: OrdineEnhanced) => {
    try {
      console.log('🔄 Marking order as arrived:', ordine.id)
      const today = new Date().toISOString().slice(0,10)

      const { data, error } = await supabase
        .from('ordini_materiali')
        .update({
          stato: 'consegnato',
          data_consegna_effettiva: today,
          updated_at: new Date().toISOString()
        })
        .eq('id', ordine.id)
        .select()

      if (error) {
        console.error('❌ Error updating order:', error)
        throw error
      }

      console.log('✅ Order marked as arrived:', data)
      await fetchOrdiniEnhanced()

      // Show success message (no import needed, it's already available)
      console.log('✅ Order marked as arrived successfully')

    } catch (error: any) {
      console.error('❌ Error in markArrivato:', error)
      setError(`Errore nell'aggiornamento: ${error.message}`)
    }
  }

  // UI Helper functions
  const getTabConfig = (key: string) => {
    return tabs.find(t => t.key === key) || tabs[0]
  }

  const getPriorityStyle = (priorita: string, giorni: number) => {
    if (priorita === 'urgente') return 'bg-red-100 text-red-700 border-red-200'
    if (giorni > 3) return 'bg-orange-100 text-orange-700 border-orange-200'
    return 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getMethodIcon = (metodo: string) => {
    switch (metodo) {
      case 'portale': return <Globe className="w-4 h-4" />
      case 'telefono': return <Phone className="w-4 h-4" />
      case 'email': return <Mail className="w-4 h-4" />
      case 'misto': return <Globe className="w-4 h-4" />
      default: return <Package className="w-4 h-4" />
    }
  }

  const toggleSupplier = (nome: string) => {
    const newCollapsed = new Set(collapsedSuppliers)
    if (newCollapsed.has(nome)) {
      newCollapsed.delete(nome)
    } else {
      newCollapsed.add(nome)
    }
    setCollapsedSuppliers(newCollapsed)
  }

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const currentTab = getTabConfig(activeTab)
  const TabIcon = currentTab.icon

  // Statistics
  const stats = {
    totalOrders: ordini.length,
    urgentOrders: ordini.filter(o => o.priorita === 'urgente').length,
    totalSuppliers: Object.keys(ordiniPerFornitore).length,
    delayedOrders: ordini.filter(o => o.giorni_aperti > 5).length
  }

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna alla Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-3">
              <TabIcon className={`w-6 h-6 text-${currentTab.color}-600`} />
              <h1 className="text-2xl font-bold text-gray-900">Gestione Ordini</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'grouped' : 'table')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {viewMode === 'table' ? '📊 Vista Raggruppata' : '📋 Vista Tabella'}
            </button>
            <button
              onClick={fetchOrdiniEnhanced}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className={`bg-${currentTab.color}-50 p-4 rounded-lg`}>
            <div className={`text-2xl font-bold text-${currentTab.color}-700`}>{stats.totalOrders}</div>
            <div className={`text-sm text-${currentTab.color}-600`}>Ordini {currentTab.label.toLowerCase()}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{stats.urgentOrders}</div>
            <div className="text-sm text-red-600">Urgenti</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">{stats.totalSuppliers}</div>
            <div className="text-sm text-purple-600">Fornitori coinvolti</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-700">{stats.delayedOrders}</div>
            <div className="text-sm text-orange-600">In ritardo</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeTab === tab.key
                    ? `bg-${tab.color}-600 text-white border-${tab.color}-600`
                    : `bg-white text-gray-700 border-gray-200 hover:bg-${tab.color}-50`
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Bulk Actions */}
        {activeTab === 'da_ordinare' && selectedOrders.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-800 font-medium">
                {selectedOrders.size} ordini selezionati
              </span>
              <div className="flex space-x-3">
                <button
                  onClick={markSelectedAsOrdered}
                  disabled={bulkUpdating}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {bulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Marca come Ordinati</span>
                </button>
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Deseleziona tutto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-4">Caricamento ordini...</p>
          </div>
        ) : ordini.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun ordine trovato</h4>
            <p className="text-gray-500">
              {activeTab === 'da_ordinare'
                ? 'Tutti gli ordini sono già stati gestiti! 🎉'
                : `Nessun ordine nello stato "${currentTab.label}"`
              }
            </p>
          </div>
        ) : (
          /* Main Content */
          viewMode === 'grouped' ? (
            /* Grouped View by Supplier */
            <div className="space-y-4">
              {Object.entries(ordiniPerFornitore).map(([nomeFornitore, fornitore]) => {
                const isExpanded = !collapsedSuppliers.has(nomeFornitore)
                const ordiniSelezionatiFornitore = fornitore.ordini.filter(o => selectedOrders.has(o.id)).length
                const ordiniUrgenti = fornitore.ordini.filter(o => o.priorita === 'urgente').length

                return (
                  <div key={nomeFornitore} className="bg-white rounded-lg shadow-sm border border-gray-200">
                    {/* Supplier Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => toggleSupplier(nomeFornitore)}
                            className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                          >
                            {isExpanded ?
                              <ChevronDown className="w-5 h-5 text-gray-500" /> :
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            }
                            <div className="text-left">
                              <div className="font-semibold text-lg text-gray-900 flex items-center">
                                {getMethodIcon(fornitore.metodo_ordine)}
                                <span className="ml-2">{nomeFornitore}</span>
                                <span className="ml-2 text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {fornitore.ordini.length} ordini
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Status Badges */}
                          <div className="flex space-x-2">
                            {ordiniUrgenti > 0 && (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                                ⚠️ {ordiniUrgenti} urgenti
                              </span>
                            )}
                            {fornitore.tempi_medi && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                                📅 {fornitore.tempi_medi}gg medi
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {ordiniSelezionatiFornitore > 0 && (
                            <span className="text-sm text-blue-600">
                              {ordiniSelezionatiFornitore}/{fornitore.ordini.length} selezionati
                            </span>
                          )}

                          {/* Supplier Actions */}
                          <div className="flex space-x-2">
                            {fornitore.web_address && (
                              <a
                                href={fornitore.web_address}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                <span>Portale</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Supplier Notes */}
                      {fornitore.note && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          💡 {fornitore.note}
                        </div>
                      )}
                    </div>

                    {/* Orders List */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                        {fornitore.ordini.map((ordine) => (
                          <div
                            key={ordine.id}
                            className={`p-4 border rounded-lg transition-colors ${
                              selectedOrders.has(ordine.id)
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 flex-1">
                                {activeTab === 'da_ordinare' && (
                                  <input
                                    type="checkbox"
                                    checked={selectedOrders.has(ordine.id)}
                                    onChange={() => toggleOrderSelection(ordine.id)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                )}

                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-1">
                                    <Link
                                      href={`/dashboard/buste/${ordine.buste.id}`}
                                      className="font-medium text-blue-600 hover:text-blue-800"
                                    >
                                      Busta {ordine.buste.readable_id}
                                    </Link>
                                    <span className={`px-2 py-1 rounded text-xs border ${getPriorityStyle(ordine.priorita, ordine.giorni_aperti)}`}>
                                      {ordine.priorita === 'urgente' ? '⚠️ URGENTE' :
                                       ordine.giorni_aperti > 5 ? '⏰ RITARDO' : '📋 Normale'}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {ordine.giorni_aperti} giorni fa
                                    </span>
                                  </div>

                                  <div className="text-sm text-gray-600 flex items-center space-x-4 mb-2">
                                    <span className="flex items-center">
                                      <User className="w-3 h-3 mr-1" />
                                      {ordine.buste.clienti?.cognome} {ordine.buste.clienti?.nome}
                                    </span>
                                    {ordine.buste.clienti?.telefono && (
                                      <span className="flex items-center">
                                        <Phone className="w-3 h-3 mr-1" />
                                        {ordine.buste.clienti.telefono}
                                      </span>
                                    )}
                                  </div>

                                  <div className="font-medium text-gray-900 mb-1">
                                    {ordine.descrizione_prodotto}
                                  </div>

                                  {ordine.note && (
                                    <div className="text-sm text-gray-500 italic">
                                      Note: {ordine.note}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Order Actions */}
                              <div className="flex items-center space-x-2 ml-4">
                                {ordine.stato === 'da_ordinare' && (
                                  <button
                                    onClick={() => openSupplierPortal(ordine)}
                                    className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                    title={ordine.fornitore_web_address ?
                                      `Apri portale ${ordine.fornitore_nome}` :
                                      'Apri portale mock (URL reale non disponibile)'
                                    }
                                  >
                                    🌐 Ordina
                                  </button>
                                )}
                                {(ordine.stato === 'ordinato' || ordine.stato === 'in_arrivo') && (
                                  <button
                                    onClick={() => markArrivato(ordine)}
                                    className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Arrivato
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {activeTab === 'da_ordinare' && <th className="text-left px-4 py-3">Sel.</th>}
                    <th className="text-left px-4 py-3">Busta</th>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Prodotto</th>
                    <th className="text-left px-4 py-3">Fornitore</th>
                    <th className="text-left px-4 py-3">Stato</th>
                    <th className="text-left px-4 py-3">Priorità</th>
                    <th className="text-left px-4 py-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {ordini.map((ordine) => (
                    <tr key={ordine.id} className="border-t hover:bg-gray-50">
                      {activeTab === 'da_ordinare' && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(ordine.id)}
                            onChange={() => toggleOrderSelection(ordine.id)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/buste/${ordine.buste.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {ordine.buste.readable_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {ordine.buste.clienti ? `${ordine.buste.clienti.cognome} ${ordine.buste.clienti.nome}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{ordine.descrizione_prodotto}</td>
                      <td className="px-4 py-3 text-gray-700">{ordine.fornitore_nome || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {ordine.stato}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getPriorityStyle(ordine.priorita, ordine.giorni_aperti)}`}>
                          {ordine.priorita === 'urgente' ? '⚠️ Urgente' : 'Normale'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {ordine.stato === 'da_ordinare' && (
                            <button
                              onClick={() => openSupplierPortal(ordine)}
                              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                              title={ordine.fornitore_web_address ?
                                `Apri portale ${ordine.fornitore_nome}` :
                                'Apri portale mock (URL reale non disponibile)'
                              }
                            >
                              🌐 Ordina
                            </button>
                          )}
                          {(ordine.stato === 'ordinato' || ordine.stato === 'in_arrivo') && (
                            <button
                              onClick={() => markArrivato(ordine)}
                              className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                            >
                              Arrivato
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
