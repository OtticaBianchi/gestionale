'use client'

import { FollowUpStatistics, StatisticsSummary } from '../_types'
import { StatCard } from './StatCard'
import { StatisticsTable } from './StatisticsTable'

interface StatisticsDashboardProps {
  statistics: {
    data: FollowUpStatistics[]
    summary: StatisticsSummary
  }
  isLoading: boolean
}

export function StatisticsDashboard({ statistics, isLoading }: StatisticsDashboardProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Caricamento statistiche...</p>
      </div>
    )
  }

  const { summary, data } = statistics

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Dashboard Statistiche Follow-up
        </h2>
        <p className="text-gray-600">
          Panoramica delle performance delle chiamate di soddisfazione
        </p>
      </div>

      {/* Cards riassuntive */}
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

      {/* Tabella dettagliata */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Dettaglio per Operatore e Data
            </h3>
          </div>
          <StatisticsTable data={data} />
        </div>
      )}

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">💡 Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white/60 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Performance Generale</h4>
            {summary.tasso_completamento >= 80 ? (
              <p className="text-green-700">✅ Ottimo tasso di completamento delle chiamate</p>
            ) : summary.tasso_completamento >= 60 ? (
              <p className="text-yellow-700">⚠️ Tasso di completamento migliorabile</p>
            ) : (
              <p className="text-red-700">❌ Tasso di completamento troppo basso</p>
            )}
          </div>

          <div className="bg-white/60 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Soddisfazione Clienti</h4>
            {summary.tasso_soddisfazione >= 85 ? (
              <p className="text-green-700">⭐ Eccellente livello di soddisfazione</p>
            ) : summary.tasso_soddisfazione >= 70 ? (
              <p className="text-yellow-700">👍 Buon livello di soddisfazione</p>
            ) : (
              <p className="text-red-700">📈 Servizio da migliorare</p>
            )}
          </div>

          <div className="bg-white/60 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Problemi Tecnici</h4>
            {summary.problemi_tecnici === 0 ? (
              <p className="text-green-700">✅ Nessun problema con i contatti</p>
            ) : summary.problemi_tecnici <= 5 ? (
              <p className="text-yellow-700">⚠️ Pochi problemi di contatto</p>
            ) : (
              <p className="text-red-700">📋 Aggiornare database clienti</p>
            )}
          </div>

          <div className="bg-white/60 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Follow-up Pendenti</h4>
            {summary.da_richiamare_totali === 0 ? (
              <p className="text-green-700">✅ Tutti i clienti sono stati contattati</p>
            ) : (
              <p className="text-blue-700">🔄 {summary.da_richiamare_totali} richiamati da programmare</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}