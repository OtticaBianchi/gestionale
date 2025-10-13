'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  Heart,
  Download,
  Edit,
  Calendar,
  User,
  Eye,
  Clock,
  FileText,
  CheckSquare,
  GraduationCap,
  AlertTriangle,
  Users,
  Settings,
  CreditCard,
  Package,
  Monitor,
  Trophy,
  Zap,
  Wrench,
  ExternalLink,
  Phone
} from 'lucide-react'
import { Database } from '@/types/database.types'

type Procedure = {
  id: string
  title: string
  slug: string
  description: string
  content: string
  context_category: string
  procedure_type: string
  target_roles: string[]
  search_tags: string[]
  is_favorited: boolean
  view_count: number
  version: number
  last_reviewed_at: string
  created_at: string
  updated_at: string
  created_by_profile: { full_name: string }
  updated_by_profile: { full_name: string }
  last_reviewed_by_profile: { full_name: string }
  related_procedures: any[]
  dependent_procedures: any[]
}

export default function ProcedurePage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const [procedure, setProcedure] = useState<Procedure | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const contentMetadata = useMemo(() => {
    if (!procedure?.content) return { author: null, reviewer: null }

    const authorMatch = procedure.content.match(/\*\*Autore:\*\*\s*([^\n]+)/i) || procedure.content.match(/Autore:\s*([^\n]+)/i)
    const reviewerMatch = procedure.content.match(/Responsabile aggiornamento:\s*([^\n]+)/i)

    return {
      author: authorMatch ? authorMatch[1].replace(/\*\*/g, '').trim() : null,
      reviewer: reviewerMatch ? reviewerMatch[1].replace(/\*\*/g, '').trim() : null
    }
  }, [procedure?.content])

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
    fetchProcedure()
  }, [slug])

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

  const fetchProcedure = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/procedures/${slug}`)
      const result = await response.json()

      if (result.success) {
        setProcedure(result.data)
      } else {
        router.push('/procedure')
      }
    } catch (error) {
      console.error('Error fetching procedure:', error)
      router.push('/procedure')
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async () => {
    if (!procedure) return

    try {
      const response = await fetch(`/api/procedures/${slug}/favorite`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        setProcedure(prev => prev ? { ...prev, is_favorited: result.is_favorited } : null)
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const downloadPDF = async () => {
    if (!procedure || userRole !== 'admin') return

    try {
      const response = await fetch(`/api/procedures/${slug}/pdf`)
      if (response.ok) {
        const htmlContent = await response.text()
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `procedura-${procedure.slug}.html`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!procedure) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Procedura non trovata</h2>
          <button
            onClick={() => router.push('/procedure')}
            className="text-blue-600 hover:text-blue-700"
          >
            Torna al manuale procedure
          </button>
        </div>
      </div>
    )
  }

  const categoryInfo = categories[procedure.context_category as keyof typeof categories]
  const typeInfo = procedureTypes[procedure.procedure_type as keyof typeof procedureTypes]
  const CategoryIcon = categoryInfo?.icon || FileText
  const TypeIcon = typeInfo?.icon || FileText
  const createdByDisplay = contentMetadata.author || procedure.created_by_profile?.full_name || 'Sistema'
  const updatedByDisplay = contentMetadata.reviewer || procedure.updated_by_profile?.full_name || 'Sistema'
  const reviewedByDisplay = contentMetadata.reviewer || procedure.last_reviewed_by_profile?.full_name || 'Sistema'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/procedure')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Torna alle Procedure</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg transition-colors ${
                  procedure.is_favorited
                    ? 'text-red-500 bg-red-50 hover:bg-red-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-5 h-5 ${procedure.is_favorited ? 'fill-current' : ''}`} />
              </button>

              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => router.push(`/procedure/admin/${slug}`)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Modifica</span>
                  </button>
                  <button
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Esporta PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Procedure Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className={`p-4 rounded-xl ${categoryInfo?.color || 'bg-gray-500'} text-white`}>
              <CategoryIcon className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{procedure.title}</h1>
                  {procedure.description && (
                    <p className="text-lg text-gray-600 mb-4">{procedure.description}</p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <CategoryIcon className="w-4 h-4" />
                    <span>Categoria</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {categoryInfo?.label || procedure.context_category}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <TypeIcon className={`w-4 h-4 ${typeInfo?.color || 'text-gray-500'}`} />
                    <span>Tipo</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {typeInfo?.label || procedure.procedure_type}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Eye className="w-4 h-4" />
                    <span>Visualizzazioni</span>
                  </div>
                  <span className="font-medium text-gray-900">{procedure.view_count}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock className="w-4 h-4" />
                    <span>Versione</span>
                  </div>
                  <span className="font-medium text-gray-900">v{procedure.version}</span>
                </div>
              </div>

              {/* Target Roles */}
              {procedure.target_roles && procedure.target_roles.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Destinatari</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {procedure.target_roles.map((role) => (
                      <span
                        key={role}
                        className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {roles[role as keyof typeof roles] || role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Procedure Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, children }) => {
                  const textContent = (() => {
                    if (typeof children === 'string') return children
                    if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
                      return children[0]
                    }
                    return null
                  })()

                  if (textContent) {
                    const normalized = textContent.replace(/\s+/g, ' ').trim()

                    if (/\b(?:☐|- \[ \])/.test(normalized)) {
                      return (
                        <div className="flex items-start gap-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg mb-2">
                          <CheckSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-800">
                            {normalized.replace(/☐|- \[ \]/g, '').trim()}
                          </span>
                        </div>
                      )
                    }

                    if (/\b(?:☑|✓|- \[x\])/.test(normalized)) {
                      return (
                        <div className="flex items-start gap-3 p-3 bg-green-50 border-l-4 border-green-400 rounded-r-lg mb-2">
                          <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-800 line-through">
                            {normalized.replace(/☑|✓|- \[x\]/g, '').trim()}
                          </span>
                        </div>
                      )
                    }

                    if (normalized.includes('❌')) {
                      return (
                        <div className="flex items-start gap-3 p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-red-800">
                            {normalized.replace('❌', '').trim()}
                          </span>
                        </div>
                      )
                    }
                  }

                  return <p className="text-gray-700 mb-3">{children}</p>
                },
                h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mb-6 mt-8">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-medium text-gray-800 mb-3 mt-4">{children}</h3>,
                ul: ({ children }) => <ul className="list-none space-y-2 mb-4">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">{children}</ol>,
                li: ({ children }) => (
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2.5 flex-shrink-0"></span>
                    <span className="text-gray-700">{children}</span>
                  </li>
                ),
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full border border-gray-200 rounded-lg text-sm text-left">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-gray-50">{children}</tr>,
                th: ({ children }) => (
                  <th className="px-4 py-3 font-semibold border-b border-gray-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-3 align-top text-gray-700">
                    {children}
                  </td>
                ),
              }}
            >
              {procedure.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Related Procedures */}
        {(procedure.related_procedures?.length > 0 || procedure.dependent_procedures?.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Procedure Correlate</h2>

            {procedure.related_procedures?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Procedure Prerequisite/Correlate</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {procedure.related_procedures.map((rel: any) => {
                    const relatedProc = rel.related_procedure
                    const categoryInfo = categories[relatedProc.context_category as keyof typeof categories]
                    const CategoryIcon = categoryInfo?.icon || FileText

                    return (
                      <button
                        key={relatedProc.id}
                        onClick={() => router.push(`/procedure/${relatedProc.slug}`)}
                        className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className={`p-2 rounded-lg ${categoryInfo?.color || 'bg-gray-500'} text-white`}>
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{relatedProc.title}</div>
                          <div className="text-sm text-gray-500 capitalize">{rel.relationship_type}</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {procedure.dependent_procedures?.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">Procedure Successive</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {procedure.dependent_procedures.map((dep: any) => {
                    const dependentProc = dep.dependent_procedure
                    const categoryInfo = categories[dependentProc.context_category as keyof typeof categories]
                    const CategoryIcon = categoryInfo?.icon || FileText

                    return (
                      <button
                        key={dependentProc.id}
                        onClick={() => router.push(`/procedure/${dependentProc.slug}`)}
                        className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className={`p-2 rounded-lg ${categoryInfo?.color || 'bg-gray-500'} text-white`}>
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{dependentProc.title}</div>
                          <div className="text-sm text-gray-500 capitalize">{dep.relationship_type}</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Metadata */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4" />
                <span>Creato da</span>
              </div>
              <span className="font-medium text-gray-900">
                {createdByDisplay}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(procedure.created_at).toLocaleDateString('it-IT')}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4" />
                <span>Aggiornato da</span>
              </div>
              <span className="font-medium text-gray-900">
                {updatedByDisplay}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(procedure.updated_at).toLocaleDateString('it-IT')}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4" />
                <span>Ultima revisione</span>
              </div>
              <span className="font-medium text-gray-900">
                {reviewedByDisplay}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(procedure.last_reviewed_at).toLocaleDateString('it-IT')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
