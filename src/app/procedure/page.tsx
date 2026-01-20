'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Search,
  ArrowLeft,
  Clock,
  Plus,
  FileText,
  CheckSquare,
  GraduationCap,
  AlertTriangle,
  Users,
  Settings,
  Calendar,
  Eye,
  Wrench,
  Package,
  CreditCard,
  Monitor,
  Trophy,
  Zap,
  BookOpen,
  Heart,
  TrendingUp,
  Phone
} from 'lucide-react'
import { Database } from '@/types/database.types'

type Procedure = {
  id: string
  title: string
  slug: string
  description: string
  context_category: string
  procedure_type: string
  target_roles: string[]
  search_tags: string[]
  is_favorited?: boolean
  view_count: number
  mini_help_title: string
  mini_help_summary: string
  mini_help_action: string
  last_reviewed_at: string
  created_at: string
  updated_at: string
  version: number
  is_unread?: boolean
  is_new?: boolean
  is_updated?: boolean
  user_acknowledged_at?: string | null
  user_acknowledged_updated_at?: string | null
  user_acknowledged_version?: number | null
}

export default function ProceduresPage() {
  const router = useRouter()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [showRead, setShowRead] = useState(false)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const categories = {
    'accoglienza': { label: 'Accoglienza', icon: Users, color: 'bg-blue-500' },
    'vendita': { label: 'Vendita', icon: CreditCard, color: 'bg-green-500' },
    'appuntamenti': { label: 'Appuntamenti', icon: Calendar, color: 'bg-purple-500' },
    'sala_controllo': { label: 'Sala Controllo', icon: Eye, color: 'bg-indigo-500' },
    'lavorazioni': { label: 'Lavorazioni', icon: Wrench, color: 'bg-orange-500' },
    'consegna': { label: 'Consegna', icon: Package, color: 'bg-emerald-500' },
    'customer_care': { label: 'Customer Care', icon: Phone, color: 'bg-pink-500' },
    'amministrazione': { label: 'Amministrazione', icon: Settings, color: 'bg-gray-500' },
    'it': { label: 'IT', icon: Monitor, color: 'bg-cyan-500' },
    'sport': { label: 'Sport', icon: Trophy, color: 'bg-red-500' },
    'straordinarie': { label: 'Straordinarie', icon: Zap, color: 'bg-yellow-500' }
  }

  const procedureTypes = {
    'checklist': { label: 'Checklist', icon: CheckSquare, color: 'text-blue-600' },
    'istruzioni': { label: 'Istruzioni', icon: FileText, color: 'text-green-600' },
    'formazione': { label: 'Formazione', icon: GraduationCap, color: 'text-purple-600' },
    'errori_frequenti': { label: 'Errori Frequenti', icon: AlertTriangle, color: 'text-red-600' }
  }

  const priorityLevels = {
    'priorita-p1': { label: 'P1 Critica', color: 'bg-red-100 text-red-800 border-red-200', border: 'border-red-300' },
    'priorita-p2': { label: 'P2 Servizio e Clienti', color: 'bg-orange-100 text-orange-800 border-orange-200', border: 'border-orange-300' },
    'priorita-p3': { label: 'P3 Operativa', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', border: 'border-yellow-300' },
    'priorita-p4': { label: 'P4 Cultura Aziendale', color: 'bg-blue-100 text-blue-800 border-blue-200', border: 'border-blue-300' }
  }

  const roles = {
    'addetti_vendita': 'Addetti Vendita',
    'optometrista': 'Optometrista',
    'titolare': 'Titolare',
    'manager_responsabile': 'Manager/Responsabile',
    'laboratorio': 'Laboratorio',
    'responsabile_sport': 'Responsabile Sport'
  }

  useEffect(() => {
    fetchUserRole()
    fetchProcedures()
  }, [])

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role)
      }
    }
  }

  const fetchProcedures = async (overrides: {
    search?: string
    category?: string
    type?: string
    role?: string
    favorites?: boolean
    includeRead?: boolean
  } = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const searchValue = overrides.search ?? searchTerm
      const categoryValue = overrides.category ?? selectedCategory
      const typeValue = overrides.type ?? selectedType
      const roleValue = overrides.role ?? selectedRole
      const favoritesValue = overrides.favorites ?? favoritesOnly
      const includeReadValue = overrides.includeRead ?? showRead

      if (favoritesValue) params.append('favorites', 'true')
      if (searchValue) params.append('search', searchValue)
      if (categoryValue) params.append('context_category', categoryValue)
      if (typeValue) params.append('procedure_type', typeValue)
      if (roleValue) params.append('target_role', roleValue)
      if (includeReadValue) params.append('include_read', 'true')

      const response = await fetch(`/api/procedures?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setProcedures(result.data)
        if (typeof result.meta?.unread_count === 'number') {
          setUnreadCount(result.meta.unread_count)
          window.dispatchEvent(new CustomEvent('procedures:unread:update', {
            detail: { count: result.meta.unread_count }
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching procedures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchProcedures()
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedType('')
    setSelectedRole('')
    setFavoritesOnly(false)
    setShowRead(false)
    fetchProcedures({
      search: '',
      category: '',
      type: '',
      role: '',
      favorites: false,
      includeRead: false
    })
  }

  const toggleFavoritesFilter = () => {
    setFavoritesOnly((prev) => {
      const nextValue = !prev
      fetchProcedures({ favorites: nextValue })
      return nextValue
    })
  }

  const toggleShowRead = () => {
    setShowRead((prev) => {
      const nextValue = !prev
      fetchProcedures({ includeRead: nextValue })
      return nextValue
    })
  }

  const toggleFavorite = async (slug: string) => {
    try {
      const response = await fetch(`/api/procedures/${slug}/favorite`, {
        method: 'POST'
      })

      if (response.ok) {
        if (favoritesOnly) {
          fetchProcedures({ favorites: true })
        } else {
          setProcedures((current) =>
            current.map((proc) =>
              proc.slug === slug ? { ...proc, is_favorited: !proc.is_favorited } : proc
            )
          )
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const ProcedureCard = ({ procedure }: { procedure: Procedure }) => {
    const categoryInfo = categories[procedure.context_category as keyof typeof categories]
    const typeInfo = procedureTypes[procedure.procedure_type as keyof typeof procedureTypes]
    const isUnread = procedure.is_unread !== false
    const isNew = procedure.is_new === true
    const isUpdated = !isNew && procedure.is_updated === true
    const acknowledgedAt = procedure.user_acknowledged_at
      ? new Date(procedure.user_acknowledged_at).toLocaleDateString('it-IT')
      : null
    const normalizedTags = procedure.search_tags?.map((tag) => tag.replace(/_/g, '-')) || []
    const priorityTag = normalizedTags.find((tag) => tag in priorityLevels)
    const priorityInfo = priorityTag
      ? priorityLevels[priorityTag as keyof typeof priorityLevels]
      : null
    const priorityBorder = priorityInfo?.border || 'border-gray-200'

    return (
      <div
        className={`bg-white rounded-lg shadow-sm border transition-shadow ${priorityBorder} ${
          isUnread ? 'bg-blue-50/40 hover:shadow-lg' : 'hover:shadow-md'
        }`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">{procedure.title}</h3>
              <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${categoryInfo?.color || 'bg-gray-500'}`} />
                  <span className="capitalize">{categoryInfo?.label || procedure.context_category}</span>
                </span>
                <span>•</span>
                <span>{typeInfo?.label || procedure.procedure_type}</span>
              </div>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                {isNew && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    Nuova
                  </span>
                )}
                {isUpdated && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                    Aggiornata
                  </span>
                )}
                {!isUnread && acknowledgedAt && showRead && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                    Letta il {acknowledgedAt}
                  </span>
                )}
                  {priorityInfo && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityInfo.color}`}>
                      {priorityInfo.label} · priorita
                    </span>
                  )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(procedure.slug)}
                className={`p-1 rounded hover:bg-gray-100 ${
                  procedure.is_favorited ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${procedure.is_favorited ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Mini Help */}
          {procedure.mini_help_summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-800 text-xs font-semibold">{procedure.mini_help_title}</p>
                  <p className="text-blue-700 text-xs mt-1">{procedure.mini_help_summary}</p>
                  {procedure.mini_help_action && (
                    <p className="text-blue-600 text-xs mt-1 font-medium">{procedure.mini_help_action}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Target Roles */}
          {procedure.target_roles && procedure.target_roles.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {procedure.target_roles.slice(0, 3).map((role) => (
                  <span
                    key={role}
                    className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] rounded-full"
                  >
                    {roles[role as keyof typeof roles] || role}
                  </span>
                ))}
                {procedure.target_roles.length > 3 && (
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] rounded-full">
                    +{procedure.target_roles.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 text-[11px] text-gray-500">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{procedure.view_count} visualizzazioni</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  Agg. {new Date(procedure.last_reviewed_at || procedure.updated_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/procedure/${procedure.slug}`)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Leggi
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Torna alla Dashboard</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">📚 Manuale Procedure</h1>
              {unreadCount > 0 ? (
                <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-red-500 text-white">
                  {unreadCount} da leggere
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                  Tutte aggiornate
                </span>
              )}
              <button
                onClick={() => router.push('/casi-non-previsti')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Casi NON Previsti</span>
              </button>
              {userRole === 'admin' && (
                <button
                  onClick={() => router.push('/procedure/admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Gestisci</span>
                </button>
              )}
            </div>
          </div>
      </div>
    </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca procedure..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutte le categorie</option>
              {Object.entries(categories).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutti i tipi</option>
              {Object.entries(procedureTypes).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutti i ruoli</option>
              {Object.entries(roles).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cerca
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Pulisci filtri
            </button>
            <button
              onClick={toggleFavoritesFilter}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                favoritesOnly
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${favoritesOnly ? 'text-red-600' : 'text-gray-500'}`} />
              {favoritesOnly ? 'Mostra tutte' : 'Solo preferite'}
            </button>
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={!showRead}
                onChange={toggleShowRead}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-600 text-sm">Nascondi lette</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 px-6 py-4 mb-6">
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900 mb-2">Schema priorità (ordine P1 → P4):</p>
            <p className="mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityLevels['priorita-p1'].color}`}>P1 Critica</span>
              <span className="ml-2">P1 (Priorità 1): Critica. Significa che la procedura riguarda rischi legali/finanziari o sicurezza/qualita del servizio.</span>
            </p>
            <p className="mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityLevels['priorita-p2'].color}`}>P2 Servizio e Clienti</span>
              <span className="ml-2">P2 (Priorità 2): Servizio e Clienti. Questo livello di priorità riguarda le procedure che governano il servizio al cliente e il flusso operativo quotidiano.</span>
            </p>
            <p className="mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityLevels['priorita-p3'].color}`}>P3 Operativa</span>
              <span className="ml-2">P3 (Priorità 3): Operativa. Supporto operativo e logistica interna.</span>
            </p>
            <p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityLevels['priorita-p4'].color}`}>P4 Cultura Aziendale</span>
              <span className="ml-2">P4 (Priorità 4): Cultura Aziendale. Spiega i valori ed il modus operandi di OB per i nuovi assunti o chi sembra essersene dimenticato.</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Secondo criterio: piu recenti prima (ultima revisione/aggiornamento).</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {procedures.map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        )}

        {!loading && procedures.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {favoritesOnly
                ? 'Nessuna procedura preferita'
                : showRead
                ? 'Nessuna procedura disponibile'
                : 'Hai già letto tutto'}
            </h3>
            <p className="text-gray-600">
              {favoritesOnly
                ? 'Aggiungi procedure ai preferiti per trovarle qui rapidamente.'
                : showRead
                ? 'Prova a modificare i filtri di ricerca o ripristina tutti i criteri.'
                : 'Clicca su "Mostra anche lette" per rivedere le procedure già lette.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
