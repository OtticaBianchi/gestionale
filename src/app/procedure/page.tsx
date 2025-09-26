'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Search,
  Filter,
  ArrowLeft,
  Star,
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
  Download,
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
  is_featured: boolean
  is_favorited?: boolean
  view_count: number
  mini_help_title: string
  mini_help_summary: string
  mini_help_action: string
  last_reviewed_at: string
  created_at: string
  updated_at: string
}

export default function ProceduresPage() {
  const router = useRouter()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [featuredProcedures, setFeaturedProcedures] = useState<Procedure[]>([])
  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'featured' | 'recent' | 'favorites'>('featured')

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
    fetchProcedures('featured')
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

  const fetchProcedures = async (type: 'all' | 'featured' | 'recent' | 'favorites' = 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (type === 'featured') {
        params.append('featured', 'true')
      } else if (type === 'recent') {
        params.append('recent', 'true')
      } else if (type === 'favorites') {
        params.append('favorites', 'true')
      }

      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('context_category', selectedCategory)
      if (selectedType) params.append('procedure_type', selectedType)
      if (selectedRole) params.append('target_role', selectedRole)

      const response = await fetch(`/api/procedures?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        if (type === 'featured') {
          setFeaturedProcedures(result.data)
        } else if (type === 'recent') {
          setRecentProcedures(result.data)
        } else {
          setProcedures(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching procedures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: 'all' | 'featured' | 'recent' | 'favorites') => {
    setActiveTab(tab)
    if (tab === 'recent' && recentProcedures.length === 0) {
      fetchProcedures('recent')
    } else if (tab !== 'featured' && tab !== 'recent') {
      fetchProcedures(tab)
    }
  }

  const handleSearch = () => {
    if (activeTab === 'all' || activeTab === 'favorites') {
      fetchProcedures(activeTab)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedType('')
    setSelectedRole('')
    setShowFavorites(false)
    setActiveTab('featured')
  }

  const toggleFavorite = async (slug: string) => {
    try {
      const response = await fetch(`/api/procedures/${slug}/favorite`, {
        method: 'POST'
      })

      if (response.ok) {
        // Refresh current view
        if (activeTab === 'favorites') {
          fetchProcedures('favorites')
        } else {
          // Update the is_favorited status in current list
          const updateList = (list: Procedure[]) =>
            list.map(proc =>
              proc.slug === slug
                ? { ...proc, is_favorited: !proc.is_favorited }
                : proc
            )

          if (activeTab === 'featured') {
            setFeaturedProcedures(updateList(featuredProcedures))
          } else if (activeTab === 'all') {
            setProcedures(updateList(procedures))
          } else if (activeTab === 'recent') {
            setRecentProcedures(updateList(recentProcedures))
          }
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const getCurrentProcedures = () => {
    switch (activeTab) {
      case 'featured':
        return featuredProcedures
      case 'recent':
        return recentProcedures
      case 'all':
      case 'favorites':
        return procedures
      default:
        return []
    }
  }

  const ProcedureCard = ({ procedure }: { procedure: Procedure }) => {
    const categoryInfo = categories[procedure.context_category as keyof typeof categories]
    const typeInfo = procedureTypes[procedure.procedure_type as keyof typeof procedureTypes]
    const CategoryIcon = categoryInfo?.icon || FileText
    const TypeIcon = typeInfo?.icon || FileText

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${categoryInfo?.color || 'bg-gray-500'} text-white`}>
                <CategoryIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg mb-1">{procedure.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="capitalize">{categoryInfo?.label || procedure.context_category}</span>
                  <span>•</span>
                  <TypeIcon className={`w-4 h-4 ${typeInfo?.color || 'text-gray-500'}`} />
                  <span>{typeInfo?.label || procedure.procedure_type}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {procedure.is_featured && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
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

          {/* Description */}
          {procedure.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{procedure.description}</p>
          )}

          {/* Mini Help */}
          {procedure.mini_help_summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-800 text-sm font-medium">{procedure.mini_help_title}</p>
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
                    className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {roles[role as keyof typeof roles] || role}
                  </span>
                ))}
                {procedure.target_roles.length > 3 && (
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    +{procedure.target_roles.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{procedure.view_count} visualizzazioni</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Agg. {new Date(procedure.last_reviewed_at || procedure.updated_at).toLocaleDateString('it-IT')}</span>
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
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm w-fit">
          {[
            { key: 'featured', label: 'In Evidenza', icon: Star },
            { key: 'all', label: 'Tutte', icon: FileText },
            { key: 'recent', label: 'Recenti', icon: Clock },
            { key: 'favorites', label: 'Preferite', icon: Heart }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        {(activeTab === 'all' || activeTab === 'favorites') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
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

              {/* Category Filter */}
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

              {/* Type Filter */}
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

              {/* Role Filter */}
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

            <div className="flex items-center gap-3 mt-4">
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
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getCurrentProcedures().map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && getCurrentProcedures().length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'favorites' ? 'Nessuna procedura preferita' :
               activeTab === 'recent' ? 'Nessuna procedura visualizzata di recente' :
               'Nessuna procedura trovata'}
            </h3>
            <p className="text-gray-600">
              {activeTab === 'favorites' ? 'Aggiungi procedure ai preferiti per trovarle qui rapidamente.' :
               activeTab === 'recent' ? 'Le procedure che visualizzi appariranno qui.' :
               'Prova a modificare i filtri di ricerca.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}