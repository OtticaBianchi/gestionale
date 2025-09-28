'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  Star,
  Users,
  FileText,
  CheckSquare,
  GraduationCap,
  Bold,
  Italic,
  Type,
  List,
  X
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
  is_featured: boolean
  mini_help_title: string
  mini_help_summary: string
  mini_help_action: string
  last_reviewed_at: string
  created_at: string
  updated_at: string
}

export default function EditProcedurePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [procedure, setProcedure] = useState<Procedure | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)
  const [slug, setSlug] = useState<string>('')

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
    const initPage = async () => {
      const resolvedParams = await params
      setSlug(resolvedParams.slug)
      checkAdminAccess()
      fetchProcedure(resolvedParams.slug)
    }
    initPage()
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

  const fetchProcedure = async (procedureSlug: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/procedures/${procedureSlug}`)
      const result = await response.json()

      if (result.success) {
        setProcedure(result.data)
      } else {
        setError('Procedura non trovata')
      }
    } catch (error) {
      console.error('Error fetching procedure:', error)
      setError('Errore nel caricamento della procedura')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!procedure) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/procedures/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(procedure)
      })

      const result = await response.json()

      if (result.success) {
        router.push('/procedure/admin')
      } else {
        setError(result.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error saving procedure:', error)
      setError('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof Procedure, value: any) => {
    if (!procedure) return
    setProcedure({
      ...procedure,
      [field]: value
    })
  }

  const handleTargetRolesChange = (role: string, checked: boolean) => {
    if (!procedure) return

    let newRoles = [...procedure.target_roles]
    if (checked) {
      if (!newRoles.includes(role)) {
        newRoles.push(role)
      }
    } else {
      newRoles = newRoles.filter(r => r !== role)
    }

    handleFieldChange('target_roles', newRoles)
  }

  const handleSearchTagsChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    handleFieldChange('search_tags', tags)
  }

  const insertMarkdown = (markdownText: string) => {
    if (!textareaRef || !procedure) return

    const start = textareaRef.selectionStart
    const end = textareaRef.selectionEnd
    const text = procedure.content
    const before = text.substring(0, start)
    const after = text.substring(end)

    const newText = before + markdownText + after
    handleFieldChange('content', newText)

    // Reset cursor position after the inserted text
    setTimeout(() => {
      if (textareaRef) {
        textareaRef.selectionStart = textareaRef.selectionEnd = start + markdownText.length
        textareaRef.focus()
      }
    }, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !procedure) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Errore</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/procedure/admin')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Torna alle Procedure
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/procedure/admin')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Torna alla Gestione</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">✏️ Modifica Procedura</h1>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Salvando...' : 'Salva'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Base</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="procedure-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Titolo *
                </label>
                <input
                  id="procedure-title"
                  type="text"
                  value={procedure.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={procedure.is_featured}
                    onChange={(e) => handleFieldChange('is_featured', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Star className="w-4 h-4" />
                  <span className="text-sm font-medium text-gray-700">In evidenza</span>
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="procedure-description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione
              </label>
              <textarea
                id="procedure-description"
                value={procedure.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Categories and Type */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Categorizzazione</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="procedure-category" className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  id="procedure-category"
                  value={procedure.context_category}
                  onChange={(e) => handleFieldChange('context_category', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {Object.entries(categories).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="procedure-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo *
                </label>
                <select
                  id="procedure-type"
                  value={procedure.procedure_type}
                  onChange={(e) => handleFieldChange('procedure_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {Object.entries(procedureTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="search-tags" className="block text-sm font-medium text-gray-700 mb-2">
                Tag di ricerca (separate da virgola)
              </label>
              <input
                id="search-tags"
                type="text"
                value={procedure.search_tags.join(', ')}
                onChange={(e) => handleSearchTagsChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="es: tag1, tag2, tag3"
              />
            </div>
          </div>

          {/* Target Roles */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Ruoli Destinatari
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(roles).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={procedure.target_roles.includes(key)}
                    onChange={(e) => handleTargetRolesChange(key, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mini Help */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mini Aiuto</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="mini-help-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Titolo breve
                </label>
                <input
                  id="mini-help-title"
                  type="text"
                  value={procedure.mini_help_title}
                  onChange={(e) => handleFieldChange('mini_help_title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="mini-help-summary" className="block text-sm font-medium text-gray-700 mb-2">
                  Riassunto
                </label>
                <textarea
                  id="mini-help-summary"
                  value={procedure.mini_help_summary}
                  onChange={(e) => handleFieldChange('mini_help_summary', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="mini-help-action" className="block text-sm font-medium text-gray-700 mb-2">
                  Azione rapida
                </label>
                <textarea
                  id="mini-help-action"
                  value={procedure.mini_help_action}
                  onChange={(e) => handleFieldChange('mini_help_action', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Contenuto *
            </h2>

            {/* Markdown Toolbar */}
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-t-lg">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertMarkdown('**testo in grassetto**')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Grassetto"
                >
                  <Bold className="w-4 h-4" />
                  <span>B</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('*testo in corsivo*')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Corsivo"
                >
                  <Italic className="w-4 h-4" />
                  <span>I</span>
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                  type="button"
                  onClick={() => insertMarkdown('# Titolo Principale\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Titolo H1"
                >
                  <Type className="w-4 h-4" />
                  <span>H1</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('## Sottotitolo\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Sottotitolo H2"
                >
                  <Type className="w-4 h-4" />
                  <span>H2</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('### Sezione\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Sezione H3"
                >
                  <Type className="w-4 h-4" />
                  <span>H3</span>
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                  type="button"
                  onClick={() => insertMarkdown('- Elemento lista\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Lista puntata"
                >
                  <List className="w-4 h-4" />
                  <span>•</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('- [ ] Elemento checklist\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Checklist"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>☐</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('- [x] Elemento completato\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Completato"
                >
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <span>☑</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMarkdown('❌ Errore frequente\n')}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  title="Errore"
                >
                  <X className="w-4 h-4 text-red-600" />
                  <span>❌</span>
                </button>
              </div>
            </div>

            <textarea
              ref={setTextareaRef}
              value={procedure.content}
              onChange={(e) => handleFieldChange('content', e.target.value)}
              rows={20}
              className="w-full border border-gray-300 rounded-b-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Inserisci il contenuto della procedura in formato Markdown..."
              required
            />

            <div className="mt-2 text-sm text-gray-500">
              <p>Supporta Markdown: <code># Titolo</code>, <code>## Sottotitolo</code>, <code>**grassetto**</code>, <code>- [ ] checklist</code>, <code>❌ errore</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}