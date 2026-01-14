'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  FileText,
  Loader2,
  Percent
} from 'lucide-react'
import { toast } from 'sonner'

type OverallStats = {
  total_attempts: number
  total_passed: number
  total_failed: number
  pass_rate: string | number
  total_users: number
  pending_reviews: number
}

type ProcedureAnalytics = {
  procedure_id: string
  procedure_title: string
  procedure_slug: string
  total_attempts: number
  total_passed: number
  total_failed: number
  pass_rate: number
  avg_attempts_to_pass: number
}

export default function QuizAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [procedureAnalytics, setProcedureAnalytics] = useState<ProcedureAnalytics[]>([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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
    await fetchAnalytics()
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      let url = '/api/procedures/quiz/analytics'
      const params = new URLSearchParams()
      if (dateRange.start) params.append('start_date', dateRange.start)
      if (dateRange.end) params.append('end_date', dateRange.end)
      if (params.toString()) url += `?${params.toString()}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel caricamento')
      }

      setOverallStats(data.overall_stats)
      setProcedureAnalytics(data.procedure_analytics || [])
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Errore nel caricamento delle analitiche')
    } finally {
      setLoading(false)
    }
  }

  const formatPassRate = (rate: number | string) => {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate
    return numRate.toFixed(1)
  }

  const getPassRateColor = (rate: number | string) => {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : rate
    if (numRate >= 80) return 'text-green-600 bg-green-100'
    if (numRate >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
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
                <h1 className="text-2xl font-bold text-gray-900">Analitiche Quiz</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Monitoraggio performance quiz procedure
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/governance/quiz-reviews')}
                className="flex items-center gap-2 px-4 py-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Revisioni ({overallStats?.pending_reviews || 0})
              </button>
              <button
                onClick={fetchAnalytics}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Overall Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tentativi Totali</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats?.total_attempts || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Quiz Superati</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats?.total_passed || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${overallStats ? getPassRateColor(overallStats.pass_rate) : 'bg-gray-100'}`}>
                <Percent className={`w-6 h-6 ${overallStats ? '' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tasso Superamento</p>
                <p className="text-2xl font-bold text-gray-900">
                  {overallStats ? formatPassRate(overallStats.pass_rate) : 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Utenti Attivi</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats?.total_users || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Reviews Alert */}
        {overallStats && overallStats.pending_reviews > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-orange-800">
                <strong>{overallStats.pending_reviews}</strong> {overallStats.pending_reviews === 1 ? 'utente richiede' : 'utenti richiedono'} un colloquio formativo
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard/governance/quiz-reviews')}
              className="text-orange-700 hover:text-orange-900 font-medium text-sm"
            >
              Gestisci →
            </button>
          </div>
        )}

        {/* Procedure Analytics Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Performance per Procedura</h2>
            <p className="text-sm text-gray-500 mt-1">
              Analisi dettagliata dei risultati quiz per ogni procedura
            </p>
          </div>

          {procedureAnalytics.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nessun dato disponibile per il periodo selezionato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Procedura
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tentativi
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Superati
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Falliti
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      % Superamento
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Media Tentativi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {procedureAnalytics.map((proc) => (
                    <tr key={proc.procedure_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/procedure/${proc.procedure_slug}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-left"
                        >
                          {proc.procedure_title}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900">
                        {proc.total_attempts}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          {proc.total_passed}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <XCircle className="w-4 h-4" />
                          {proc.total_failed}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getPassRateColor(proc.pass_rate)}`}>
                          {formatPassRate(proc.pass_rate)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {proc.avg_attempts_to_pass ? proc.avg_attempts_to_pass.toFixed(1) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* KPI Targets Legend */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Obiettivi KPI</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-600">Tasso superamento ≥ 80%: <strong className="text-green-700">Ottimo</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-gray-600">Tasso superamento 60-79%: <strong className="text-yellow-700">Da migliorare</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-gray-600">Tasso superamento &lt; 60%: <strong className="text-red-700">Critico</strong></span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Un basso tasso di superamento può indicare che la procedura necessita di revisione per maggiore chiarezza.
          </p>
        </div>
      </div>
    </div>
  )
}
