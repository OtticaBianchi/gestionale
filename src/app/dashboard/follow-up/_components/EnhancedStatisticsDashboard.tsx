'use client'

import { useState, useEffect } from 'react'
import { StatisticsFilters, StatisticsFilters as FiltersComponent } from './StatisticsFilters'
import { StatCard } from './StatCard'
import { EnhancedStatisticsTable } from './EnhancedStatisticsTable'

export interface EnhancedFollowUpStatistics {
  periodo?: string
  periodo_display?: string
  operatore_id?: string
  operatore_nome?: string
  chiamate_totali: number
  chiamate_completate: number
  molto_soddisfatti: number
  soddisfatti: number
  poco_soddisfatti: number
  insoddisfatti: number
  non_vuole_contatto: number
  numeri_sbagliati: number
  cellulari_staccati: number
  non_risponde: number
  da_richiamare: number
  tasso_completamento: number
  tasso_soddisfazione: number
}

interface EnhancedStatisticsDashboardProps {
  initialFilters?: Partial<StatisticsFilters>
}

export function EnhancedStatisticsDashboard({
  initialFilters
}: EnhancedStatisticsDashboardProps) {
  const [filters, setFilters] = useState<StatisticsFilters>({
    timeView: 'day',
    groupBy: 'both',
    ...initialFilters
  })

  const [statistics, setStatistics] = useState<{
    data: EnhancedFollowUpStatistics[]
    summary: any
  }>({
    data: [],
    summary: {
      totale_chiamate: 0,
      tasso_completamento: 0,
      tasso_soddisfazione: 0,
      media_molto_soddisfatti: 0,
      problemi_tecnici: 0,
      da_richiamare_totali: 0
    }
  })

  const [operators, setOperators] = useState<Array<{ id: string; full_name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch operators list
  useEffect(() => {
    async function fetchOperators() {
      try {
        // This would fetch from profiles or a dedicated endpoint
        // For now, we'll extract from statistics data
        const response = await fetch('/api/follow-up/statistics')
        if (response.ok) {
          const data = await response.json()
          const operatorsMap = new Map<string, { id: string; full_name: string }>()

          data.data.forEach((stat: any) => {
            if (stat.operatore_id && stat.profiles?.full_name) {
              operatorsMap.set(stat.operatore_id, {
                id: stat.operatore_id,
                full_name: stat.profiles.full_name
              })
            }
          })

          setOperators(Array.from(operatorsMap.values()))
        }
      } catch (err) {
        console.error('Error fetching operators:', err)
      }
    }

    fetchOperators()
  }, [])

  // Fetch statistics based on filters
  useEffect(() => {
    async function fetchStatistics() {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          time_view: filters.timeView,
          group_by: filters.groupBy
        })

        if (filters.startDate) params.append('start_date', filters.startDate)
        if (filters.endDate) params.append('end_date', filters.endDate)
        if (filters.operatorId) params.append('operator_id', filters.operatorId)

        const response = await fetch(`/api/follow-up/statistics-enhanced?${params}`)

        if (!response.ok) {
          // Fallback to original statistics API
          const fallbackResponse = await fetch('/api/follow-up/statistics')
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            setStatistics(fallbackData)
          } else {
            throw new Error('Failed to fetch statistics')
          }
          return
        }

        const data = await response.json()
        setStatistics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching statistics')
        console.error('Error fetching statistics:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatistics()
  }, [filters])

  const { data, summary } = statistics

  const getTimeViewLabel = (timeView: string) => {
    const labels = {
      day: 'Giornaliera',
      week: 'Settimanale',
      month: 'Mensile',
      quarter: 'Trimestrale',
      semester: 'Semestrale',
      year: 'Annuale'
    }
    return labels[timeView as keyof typeof labels] || 'Sconosciuta'
  }

  const getGroupByLabel = (groupBy: string) => {
    const labels = {
      both: 'Data e Operatore',
      date: 'Solo Data (Aggregato)',
      operator: 'Solo Operatore (Aggregato)'
    }
    return labels[groupBy as keyof typeof labels] || 'Sconosciuto'
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-medium text-red-800 mb-2">Errore nel caricamento</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Ricarica pagina
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        operators={operators}
        isLoading={isLoading}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento statistiche...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Header Info */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Statistiche Follow-up - Vista {getTimeViewLabel(filters.timeView)}
                </h2>
                <p className="text-gray-600 mt-1">
                  Raggruppamento: {getGroupByLabel(filters.groupBy)}
                  {filters.operatorId && ` • Operatore: ${operators.find(op => op.id === filters.operatorId)?.full_name || 'Sconosciuto'}`}
                  {filters.startDate && filters.endDate && ` • Dal ${new Date(filters.startDate).toLocaleDateString('it-IT')} al ${new Date(filters.endDate).toLocaleDateString('it-IT')}`}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Record trovati</div>
                <div className="text-2xl font-bold text-gray-900">{data.length}</div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              title="Chiamate Totali"
              value={summary.totale_chiamate}
              icon="📞"
              color="blue"
            />

            <StatCard
              title="Tasso Completamento"
              value={`${summary.tasso_completamento}%`}
              icon="✅"
              color="green"
              subtitle={`su ${summary.totale_chiamate} chiamate`}
            />

            <StatCard
              title="Tasso Soddisfazione"
              value={`${summary.tasso_soddisfazione}%`}
              icon="😊"
              color="emerald"
              subtitle="clienti soddisfatti"
            />

            <StatCard
              title="Molto Soddisfatti"
              value={`${summary.media_molto_soddisfatti}%`}
              icon="⭐"
              color="yellow"
              subtitle="eccellenza servizio"
            />

            <StatCard
              title="Problemi Tecnici"
              value={summary.problemi_tecnici}
              icon="⚠️"
              color="red"
              subtitle="numeri errati/staccati"
            />

            <StatCard
              title="Da Richiamare"
              value={summary.da_richiamare_totali}
              icon="🔄"
              color="orange"
              subtitle="richieste rinvio"
            />
          </div>

          {/* Statistics Table */}
          {data.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Dettaglio Statistiche
                </h3>
              </div>
              <EnhancedStatisticsTable
                data={data}
                timeView={filters.timeView}
                groupBy={filters.groupBy}
              />
            </div>
          )}

          {data.length === 0 && (
            <div className="bg-white p-12 text-center rounded-lg border border-gray-200">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun dato trovato</h3>
              <p className="text-gray-600">
                Non ci sono statistiche per il periodo e i filtri selezionati.
                Prova a modificare i criteri di ricerca.
              </p>
            </div>
          )}

          {/* Advanced Insights */}
          {data.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">💡 Insights Avanzati</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">

                {/* Performance Insight */}
                <div className="bg-white/60 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Performance Generale</h4>
                  {summary.tasso_completamento >= 80 ? (
                    <p className="text-green-700">✅ Ottimo tasso di completamento delle chiamate ({summary.tasso_completamento}%)</p>
                  ) : summary.tasso_completamento >= 60 ? (
                    <p className="text-yellow-700">⚠️ Tasso di completamento migliorabile ({summary.tasso_completamento}%)</p>
                  ) : (
                    <p className="text-red-700">❌ Tasso di completamento troppo basso ({summary.tasso_completamento}%)</p>
                  )}
                </div>

                {/* Best Performer */}
                {filters.groupBy !== 'date' && (
                  <div className="bg-white/60 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Top Performer</h4>
                    {(() => {
                      const topPerformer = data
                        .filter(stat => stat.operatore_nome && stat.chiamate_totali > 0)
                        .sort((a, b) => b.tasso_completamento - a.tasso_completamento)[0]

                      return topPerformer ? (
                        <p className="text-blue-700">
                          🏆 {topPerformer.operatore_nome} - {topPerformer.tasso_completamento}% completamento
                        </p>
                      ) : (
                        <p className="text-gray-600">Dati insufficienti</p>
                      )
                    })()}
                  </div>
                )}

                {/* Trend Analysis */}
                {filters.timeView !== 'day' && (
                  <div className="bg-white/60 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Trend</h4>
                    {(() => {
                      if (data.length < 2) {
                        return <p className="text-gray-600">Dati insufficienti per trend</p>
                      }

                      const sortedData = [...data].sort((a, b) => {
                        const aDate = a.periodo_display || ''
                        const bDate = b.periodo_display || ''
                        return aDate.localeCompare(bDate)
                      })

                      const first = sortedData[0]
                      const last = sortedData[sortedData.length - 1]
                      const trend = last.tasso_completamento - first.tasso_completamento

                      return trend > 5 ? (
                        <p className="text-green-700">📈 Tendenza in miglioramento (+{trend.toFixed(1)}%)</p>
                      ) : trend < -5 ? (
                        <p className="text-red-700">📉 Tendenza in peggioramento ({trend.toFixed(1)}%)</p>
                      ) : (
                        <p className="text-blue-700">➡️ Tendenza stabile ({trend > 0 ? '+' : ''}{trend.toFixed(1)}%)</p>
                      )
                    })()}
                  </div>
                )}

                {/* Quality Insight */}
                <div className="bg-white/60 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Qualità Servizio</h4>
                  {summary.tasso_soddisfazione >= 85 ? (
                    <p className="text-green-700">⭐ Eccellente livello di soddisfazione ({summary.tasso_soddisfazione}%)</p>
                  ) : summary.tasso_soddisfazione >= 70 ? (
                    <p className="text-yellow-700">👍 Buon livello di soddisfazione ({summary.tasso_soddisfazione}%)</p>
                  ) : (
                    <p className="text-red-700">📈 Servizio da migliorare ({summary.tasso_soddisfazione}%)</p>
                  )}
                </div>

                {/* Technical Issues */}
                <div className="bg-white/60 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Problemi Tecnici</h4>
                  {summary.problemi_tecnici === 0 ? (
                    <p className="text-green-700">✅ Nessun problema con i contatti</p>
                  ) : summary.problemi_tecnici <= 5 ? (
                    <p className="text-yellow-700">⚠️ {summary.problemi_tecnici} problemi di contatto</p>
                  ) : (
                    <p className="text-red-700">📋 {summary.problemi_tecnici} problemi - Aggiornare database clienti</p>
                  )}
                </div>

                {/* Follow-up Actions */}
                <div className="bg-white/60 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Follow-up Pendenti</h4>
                  {summary.da_richiamare_totali === 0 ? (
                    <p className="text-green-700">✅ Tutti i clienti sono stati contattati</p>
                  ) : (
                    <p className="text-blue-700">🔄 {summary.da_richiamare_totali} clienti da richiamare</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}