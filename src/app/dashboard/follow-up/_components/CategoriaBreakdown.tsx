'use client'

import {
  getCategoriaClienteLabel,
  getCategoriaClienteColor,
  getCategoriaClienteIcon,
  type CategoriaCliente
} from '@/lib/fu2/categorizeCustomer'

interface CategoriaBreakdownProps {
  calls: Array<{ categoria_cliente?: string | null }>
}

export function CategoriaBreakdown({ calls }: CategoriaBreakdownProps) {
  // Count categories
  const categoryCounts = calls.reduce((acc, call) => {
    const cat = call.categoria_cliente || 'non_categorizzato'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Sort by count descending
  const sortedCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .filter(([cat]) => cat !== 'non_categorizzato') // Don't show uncategorized

  if (sortedCategories.length === 0) {
    return null // No categories to show
  }

  const totalCategorized = sortedCategories.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        📊 Categorizzazione Clienti
        <span className="text-sm font-normal text-gray-500">({totalCategorized} clienti)</span>
      </h3>

      <div className="space-y-3">
        {sortedCategories.map(([categoria, count]) => {
          const percentage = Math.round((count / totalCategorized) * 100)

          return (
            <div key={categoria} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ring-1 ${getCategoriaClienteColor(categoria as CategoriaCliente)}`}>
                    {getCategoriaClienteIcon(categoria as CategoriaCliente)} {getCategoriaClienteLabel(categoria as CategoriaCliente)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {count} <span className="text-xs text-gray-500">({percentage}%)</span>
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: categoria === 'perso' ? '#111827' :
                                     categoria === 'critico' ? '#ef4444' :
                                     categoria === 'a_rischio' ? '#f59e0b' :
                                     categoria === 'super_fan' ? '#a855f7' :
                                     categoria === 'fan' ? '#3b82f6' :
                                     categoria === 'delicato_su_comunicazione' ? '#06b6d4' :
                                     categoria === 'sensibile_al_prezzo' ? '#f43f5e' :
                                     '#9ca3af'
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {categoryCounts.non_categorizzato && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
          {categoryCounts.non_categorizzato} clienti non ancora categorizzati
        </div>
      )}
    </div>
  )
}
