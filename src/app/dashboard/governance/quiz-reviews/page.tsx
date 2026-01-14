'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  ArrowLeft,
  RefreshCw,
  MessageSquare,
  History,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

type ReviewItem = {
  id: string
  procedure_id: string
  user_id: string
  total_attempts: number
  consecutive_failures: number
  manager_review_requested_at: string
  procedure: {
    id: string
    title: string
    slug: string
  }
  user: {
    id: string
    nome: string
    cognome: string
    email: string
  }
}

export default function QuizReviewsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [notes, setNotes] = useState('')

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUserAndFetchData()
  }, [])

  const checkUserAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    setUserRole(profile.role)
    await fetchReviewItems()
  }

  const fetchReviewItems = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/procedures/quiz/analytics')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel caricamento')
      }

      setReviewItems(data.users_requiring_review || [])
    } catch (error) {
      console.error('Error fetching review items:', error)
      toast.error('Errore nel caricamento delle revisioni')
    } finally {
      setLoading(false)
    }
  }

  const handleResetReview = async (item: ReviewItem) => {
    if (!notes.trim()) {
      toast.error('Inserisci delle note sul colloquio formativo')
      return
    }

    setProcessingId(item.id)
    try {
      const response = await fetch('/api/procedures/quiz/manager-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedure_id: item.procedure_id,
          user_id: item.user_id,
          notes: notes.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel reset')
      }

      toast.success('Revisione completata. L\'utente può riprovare il quiz.')
      setSelectedItem(null)
      setNotes('')
      await fetchReviewItems()
    } catch (error: any) {
      console.error('Error resetting review:', error)
      toast.error(error.message || 'Errore nel completare la revisione')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (userRole !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Revisioni Quiz</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Utenti che necessitano di un colloquio formativo
                </p>
              </div>
            </div>
            <button
              onClick={fetchReviewItems}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Aggiorna
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Card */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div>
              <h2 className="text-xl font-semibold text-orange-900">
                {reviewItems.length} {reviewItems.length === 1 ? 'utente richiede' : 'utenti richiedono'} revisione
              </h2>
              <p className="text-sm text-orange-700 mt-1">
                Questi utenti hanno fallito il quiz 3 volte e necessitano di un colloquio formativo prima di poter riprovare.
              </p>
            </div>
          </div>
        </div>

        {/* Review Items List */}
        {reviewItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna revisione richiesta</h3>
            <p className="text-gray-600">Tutti gli utenti sono in regola con i quiz delle procedure.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewItems.map((item) => (
              <div
                key={`${item.procedure_id}-${item.user_id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <User className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.user?.nome} {item.user?.cognome}
                      </h3>
                      <p className="text-sm text-gray-500">{item.user?.email}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span>Procedura: <strong>{item.procedure?.title}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <History className="w-4 h-4" />
                          <span>Tentativi: <strong>{item.total_attempts}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Richiesto: {item.manager_review_requested_at
                            ? new Date(item.manager_review_requested_at).toLocaleDateString('it-IT')
                            : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Completa Revisione
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Completa Revisione
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">
                <strong>Utente:</strong> {selectedItem.user?.nome} {selectedItem.user?.cognome}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Procedura:</strong> {selectedItem.procedure?.title}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Tentativi falliti:</strong> {selectedItem.total_attempts}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Note del colloquio formativo *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descrivi brevemente gli argomenti trattati durante il colloquio formativo..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedItem(null)
                  setNotes('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleResetReview(selectedItem)}
                disabled={processingId === selectedItem.id || !notes.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === selectedItem.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Conferma e Riabilita
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
