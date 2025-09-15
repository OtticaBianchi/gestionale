'use client'

import { EnhancedFollowUpStatistics } from './EnhancedStatisticsDashboard'

interface EnhancedStatisticsTableProps {
  data: EnhancedFollowUpStatistics[]
  timeView: string
  groupBy: string
}

export function EnhancedStatisticsTable({ data, timeView, groupBy }: EnhancedStatisticsTableProps) {
  const showPeriod = groupBy !== 'operator'
  const showOperator = groupBy !== 'date'

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-700 bg-green-100'
    if (percentage >= 60) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  const getSatisfactionColor = (percentage: number) => {
    if (percentage >= 85) return 'text-emerald-700 bg-emerald-100'
    if (percentage >= 70) return 'text-blue-700 bg-blue-100'
    return 'text-orange-700 bg-orange-100'
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {showPeriod && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Periodo
              </th>
            )}
            {showOperator && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operatore
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Chiamate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Completamento
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Soddisfazione
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dettaglio Esiti
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Problemi
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((stat, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {showPeriod && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {stat.periodo_display || 'N/A'}
                </td>
              )}
              {showOperator && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stat.operatore_nome || 'Sconosciuto'}
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div className="flex flex-col">
                  <span className="font-medium">{stat.chiamate_totali}</span>
                  <span className="text-xs text-gray-500">
                    {stat.chiamate_completate} completate
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(stat.tasso_completamento)}`}>
                  {stat.tasso_completamento}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSatisfactionColor(stat.tasso_soddisfazione)}`}>
                  {stat.tasso_soddisfazione}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                <div className="space-y-1">
                  {stat.molto_soddisfatti > 0 && (
                    <div className="flex justify-between">
                      <span>⭐ Molto soddisfatti:</span>
                      <span className="font-medium">{stat.molto_soddisfatti}</span>
                    </div>
                  )}
                  {stat.soddisfatti > 0 && (
                    <div className="flex justify-between">
                      <span>😊 Soddisfatti:</span>
                      <span className="font-medium">{stat.soddisfatti}</span>
                    </div>
                  )}
                  {stat.poco_soddisfatti > 0 && (
                    <div className="flex justify-between">
                      <span>😐 Poco soddisfatti:</span>
                      <span className="font-medium text-orange-600">{stat.poco_soddisfatti}</span>
                    </div>
                  )}
                  {stat.insoddisfatti > 0 && (
                    <div className="flex justify-between">
                      <span>😞 Insoddisfatti:</span>
                      <span className="font-medium text-red-600">{stat.insoddisfatti}</span>
                    </div>
                  )}
                  {stat.non_vuole_contatto > 0 && (
                    <div className="flex justify-between">
                      <span>🚫 Non vuole contatto:</span>
                      <span className="font-medium text-gray-600">{stat.non_vuole_contatto}</span>
                    </div>
                  )}
                  {stat.non_risponde > 0 && (
                    <div className="flex justify-between">
                      <span>📵 Non risponde:</span>
                      <span className="font-medium text-gray-600">{stat.non_risponde}</span>
                    </div>
                  )}
                  {stat.da_richiamare > 0 && (
                    <div className="flex justify-between">
                      <span>🔄 Da richiamare:</span>
                      <span className="font-medium text-blue-600">{stat.da_richiamare}</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                <div className="space-y-1">
                  {stat.numeri_sbagliati > 0 && (
                    <div className="flex justify-between">
                      <span>❌ Numeri sbagliati:</span>
                      <span className="font-medium text-red-600">{stat.numeri_sbagliati}</span>
                    </div>
                  )}
                  {stat.cellulari_staccati > 0 && (
                    <div className="flex justify-between">
                      <span>📴 Staccati:</span>
                      <span className="font-medium text-red-600">{stat.cellulari_staccati}</span>
                    </div>
                  )}
                  {stat.numeri_sbagliati === 0 && stat.cellulari_staccati === 0 && (
                    <span className="text-green-600 font-medium">✅ Nessun problema</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Row */}
      <tfoot className="bg-gray-100 border-t-2 border-gray-300">
        <tr className="font-medium">
          <td colSpan={showPeriod && showOperator ? 2 : 1} className="px-6 py-3 text-sm text-gray-900">
            TOTALE
          </td>
          <td className="px-6 py-3 text-sm text-gray-900">
            <div className="flex flex-col">
              <span>{data.reduce((sum, stat) => sum + stat.chiamate_totali, 0)}</span>
              <span className="text-xs text-gray-500">
                {data.reduce((sum, stat) => sum + stat.chiamate_completate, 0)} completate
              </span>
            </div>
          </td>
          <td className="px-6 py-3 text-sm text-gray-900">
            {(() => {
              const totCalls = data.reduce((sum, stat) => sum + stat.chiamate_totali, 0)
              const totCompleted = data.reduce((sum, stat) => sum + stat.chiamate_completate, 0)
              const completionRate = totCalls > 0 ? Math.round((totCompleted / totCalls) * 100) : 0
              return (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(completionRate)}`}>
                  {completionRate}%
                </span>
              )
            })()}
          </td>
          <td className="px-6 py-3 text-sm text-gray-900">
            {(() => {
              const totCompleted = data.reduce((sum, stat) => sum + stat.chiamate_completate, 0)
              const totSatisfied = data.reduce((sum, stat) => sum + stat.molto_soddisfatti + stat.soddisfatti, 0)
              const satisfactionRate = totCompleted > 0 ? Math.round((totSatisfied / totCompleted) * 100) : 0
              return (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSatisfactionColor(satisfactionRate)}`}>
                  {satisfactionRate}%
                </span>
              )
            })()}
          </td>
          <td className="px-6 py-3 text-xs text-gray-600">
            <div className="space-y-1">
              <div>⭐ {data.reduce((sum, stat) => sum + stat.molto_soddisfatti, 0)}</div>
              <div>😊 {data.reduce((sum, stat) => sum + stat.soddisfatti, 0)}</div>
              <div>😐 {data.reduce((sum, stat) => sum + stat.poco_soddisfatti, 0)}</div>
              <div>😞 {data.reduce((sum, stat) => sum + stat.insoddisfatti, 0)}</div>
            </div>
          </td>
          <td className="px-6 py-3 text-xs text-gray-600">
            <div className="space-y-1">
              <div>❌ {data.reduce((sum, stat) => sum + stat.numeri_sbagliati, 0)}</div>
              <div>📴 {data.reduce((sum, stat) => sum + stat.cellulari_staccati, 0)}</div>
            </div>
          </td>
        </tr>
      </tfoot>
    </div>
  )
}