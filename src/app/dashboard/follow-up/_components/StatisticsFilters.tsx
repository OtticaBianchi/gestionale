'use client'

import { useState } from 'react'

export interface StatisticsFilters {
  timeView: 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year'
  groupBy: 'date' | 'operator' | 'both'
  startDate?: string
  endDate?: string
  operatorId?: string
}

interface StatisticsFiltersProps {
  filters: StatisticsFilters
  onFiltersChange: (filters: StatisticsFilters) => void
  operators?: Array<{ id: string; full_name: string }>
  isLoading?: boolean
}

export function StatisticsFilters({
  filters,
  onFiltersChange,
  operators = [],
  isLoading = false
}: StatisticsFiltersProps) {

  const handleFilterChange = (key: keyof StatisticsFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    })
  }

  const getDatePresets = () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    return {
      'Ultimi 7 giorni': {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      'Ultimi 30 giorni': {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      'Questo mese': {
        startDate: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      'Mese scorso': {
        startDate: new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0],
        endDate: new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
      },
      'Quest\'anno': {
        startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      },
      'Anno scorso': {
        startDate: new Date(currentYear - 1, 0, 1).toISOString().split('T')[0],
        endDate: new Date(currentYear - 1, 11, 31).toISOString().split('T')[0]
      }
    }
  }

  const presets = getDatePresets()

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filtri Statistiche</h3>
      </div>

      {/* Time View Selection */}
      <div>
        <label htmlFor="time-view" className="block text-sm font-medium text-gray-700 mb-2">
          Vista Temporale
        </label>
        <select
          id="time-view"
          value={filters.timeView}
          onChange={(e) => handleFilterChange('timeView', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="day">Giornaliera</option>
          <option value="week">Settimanale</option>
          <option value="month">Mensile</option>
          <option value="quarter">Trimestrale</option>
          <option value="semester">Semestrale</option>
          <option value="year">Annuale</option>
        </select>
      </div>

      {/* Group By Selection */}
      <div>
        <label htmlFor="group-by" className="block text-sm font-medium text-gray-700 mb-2">
          Raggruppa per
        </label>
        <select
          id="group-by"
          value={filters.groupBy}
          onChange={(e) => handleFilterChange('groupBy', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="both">Data e Operatore</option>
          <option value="date">Solo Data (Aggregato)</option>
          <option value="operator">Solo Operatore (Aggregato)</option>
        </select>
      </div>

      {/* Operator Selection */}
      <div>
        <label htmlFor="operator" className="block text-sm font-medium text-gray-700 mb-2">
          Operatore
        </label>
        <select
          id="operator"
          value={filters.operatorId || ''}
          onChange={(e) => handleFilterChange('operatorId', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="">Tutti gli operatori</option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.full_name || `Operatore ${operator.id.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
            Data Inizio
          </label>
          <input
            id="start-date"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
            Data Fine
          </label>
          <input
            id="end-date"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Date Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preimpostazioni
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(presets).map(([label, dates]) => (
            <button
              key={label}
              onClick={() => onFiltersChange({
                ...filters,
                ...dates
              })}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md border transition-colors"
              disabled={isLoading}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => onFiltersChange({
            timeView: 'day',
            groupBy: 'both',
            startDate: undefined,
            endDate: undefined,
            operatorId: undefined
          })}
          className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          disabled={isLoading}
        >
          Pulisci Filtri
        </button>
      </div>
    </div>
  )
}