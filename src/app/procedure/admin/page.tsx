'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Download,
  Star,
  Eye,
  Search,
  Filter
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
  is_featured: boolean
  view_count: number
  last_reviewed_at: string
  created_at: string
  updated_at: string
}

export default function ProceduresAdminPage() {
  const router = useRouter()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const categories = {
    'accoglienza': 'Accoglienza',
    'vendita': 'Vendita',
    'appuntamenti': 'Appuntamenti',
    'sala_controllo': 'Sala Controllo',
    'lavorazioni': 'Lavorazioni',
    'consegna': 'Consegna',
    'customer_care': 'Customer Care',
    'amministrazione': 'Amministrazione',
    'it': 'IT',
    'sport': 'Sport',
    'straordinarie': 'Straordinarie'
  }

  const procedureTypes = {
    'checklist': 'Checklist',
    'istruzioni': 'Istruzioni',
    'formazione': 'Formazione',
    'errori_frequenti': 'Errori Frequenti'
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
    checkAdminAccess()
    fetchProcedures()
  }, [])

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        router.push('/procedure')
        return
      }
    } else {
      router.push('/procedure')
    }
  }

  const fetchProcedures = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('context_category', selectedCategory)
      if (selectedType) params.append('procedure_type', selectedType)

      const response = await fetch(`/api/procedures?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setProcedures(result.data)
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
    fetchProcedures()
  }

  const deleteProcedure = async (slug: string, title: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la procedura "${title}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/procedures/${slug}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchProcedures()
      } else {
        alert('Errore durante l\'eliminazione della procedura')
      }
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Errore durante l\'eliminazione della procedura')
    }
  }

  const downloadPDF = async (slug: string, title: string) => {
    try {
      const response = await fetch(`/api/procedures/${slug}/pdf`)
      if (response.ok) {
        const htmlContent = await response.text()
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `procedura-${slug}.html`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/procedure')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Torna alle Procedure</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">🔧 Gestione Procedure</h1>
              <button
                onClick={() => router.push('/procedure/admin/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nuova Procedura</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
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
              {Object.entries(categories).map(([key, label]) => (
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
              {Object.entries(procedureTypes).map(([key, label]) => (
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

        {/* Procedures Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Procedura</th>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Categoria</th>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Tipo</th>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Ruoli</th>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Statistiche</th>
                    <th className="text-left px-6 py-4 font-medium text-gray-900">Ultima Modifica</th>
                    <th className="text-right px-6 py-4 font-medium text-gray-900">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {procedures.map((procedure) => (
                    <tr key={procedure.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {procedure.is_featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{procedure.title}</div>
                            {procedure.description && (
                              <div className="text-sm text-gray-500 line-clamp-1">{procedure.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          {categories[procedure.context_category as keyof typeof categories] || procedure.context_category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                          {procedureTypes[procedure.procedure_type as keyof typeof procedureTypes] || procedure.procedure_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {procedure.target_roles.slice(0, 2).map((role) => (
                            <span
                              key={role}
                              className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {roles[role as keyof typeof roles] || role}
                            </span>
                          ))}
                          {procedure.target_roles.length > 2 && (
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              +{procedure.target_roles.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Eye className="w-4 h-4" />
                          <span>{procedure.view_count}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(procedure.updated_at).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/procedure/${procedure.slug}`)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Visualizza"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/procedure/admin/${procedure.slug}`)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Modifica"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadPDF(procedure.slug, procedure.title)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Esporta PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProcedure(procedure.slug, procedure.title)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {procedures.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500">Nessuna procedura trovata</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}