'use client'

import { FollowUpStatistics } from '../_types'

interface StatisticsTableProps {
  data: FollowUpStatistics[]
}

export function StatisticsTable({ data }: StatisticsTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Data / Operatore
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Chiamate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Completate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Soddisfazione
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Problemi
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Da Richiamare
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((stat) => {
            const tassoCompletamento = getPercentage(stat.chiamate_completate, stat.chiamate_totali)
            const tassoSoddisfazione = getPercentage(
              stat.molto_soddisfatti + stat.soddisfatti,
              stat.chiamate_completate
            )
            const problemiTotali = stat.numeri_sbagliati // cellulari_staccati deprecated

            return (
              <tr key={stat.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(stat.data_riferimento)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {stat.operatore_nome || 'Operatore non specificato'}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {stat.chiamate_totali}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {stat.chiamate_completate} / {stat.chiamate_totali}
                  </div>
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          tassoCompletamento >= 80 ? 'bg-green-500' :
                          tassoCompletamento >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${tassoCompletamento}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-xs text-gray-500">
                      {tassoCompletamento}%
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="flex items-center text-xs">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                      <span>Molto: {stat.molto_soddisfatti}</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-2 h-2 bg-green-300 rounded-full mr-2"></span>
                      <span>Soddisfatti: {stat.soddisfatti}</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-2 h-2 bg-orange-300 rounded-full mr-2"></span>
                      <span>Poco: {stat.poco_soddisfatti}</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-2 h-2 bg-red-300 rounded-full mr-2"></span>
                      <span>Insodd.: {stat.insoddisfatti}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Tasso: {tassoSoddisfazione}%
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1 text-xs">
                    <div className="text-red-600">
                      Num. sbagliati: {stat.numeri_sbagliati}
                    </div>
                    {/* Tel. staccati deprecated - merged with non_risponde */}
                    <div className="text-orange-600">
                      Non risponde: {stat.non_risponde}
                    </div>
                    <div className="text-gray-600">
                      Non vuole: {stat.non_vuole_contatto}
                    </div>
                  </div>
                  <div className="mt-1 text-xs font-medium text-gray-900">
                    Totale: {problemiTotali + stat.non_risponde + stat.non_vuole_contatto}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-orange-600 font-medium">
                    {stat.da_richiamare}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}