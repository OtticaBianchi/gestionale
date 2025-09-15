'use client'

import { useState, useEffect } from 'react'
import { FollowUpCall, CallUpdateData, FollowUpStatistics, StatisticsSummary } from '../_types'

export function useFollowUpData() {
  const [callList, setCallList] = useState<FollowUpCall[]>([])
  const [statistics, setStatistics] = useState<{
    data: FollowUpStatistics[]
    summary: StatisticsSummary
  }>({ data: [], summary: {
    totale_chiamate: 0,
    tasso_completamento: 0,
    tasso_soddisfazione: 0,
    media_molto_soddisfatti: 0,
    problemi_tecnici: 0,
    da_richiamare_totali: 0
  }})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carica lista chiamate esistenti all'avvio
  useEffect(() => {
    loadCallList()
    loadStatistics()
  }, [])

  const loadCallList = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/follow-up/calls')
      const result = await response.json()

      if (result.success) {
        setCallList(result.data)
        setError(null)
      } else {
        throw new Error(result.error || 'Errore caricamento chiamate')
      }
    } catch (err) {
      console.error('Errore caricamento chiamate:', err)
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStatistics = async (filters?: {
    start_date?: string
    end_date?: string
    operator_id?: string
  }) => {
    try {
      const params = new URLSearchParams()
      if (filters?.start_date) params.append('start_date', filters.start_date)
      if (filters?.end_date) params.append('end_date', filters.end_date)
      if (filters?.operator_id) params.append('operator_id', filters.operator_id)

      const response = await fetch(`/api/follow-up/statistics?${params}`)
      const result = await response.json()

      if (result.success) {
        setStatistics({
          data: result.data,
          summary: result.summary
        })
      } else {
        throw new Error(result.error || 'Errore caricamento statistiche')
      }
    } catch (err) {
      console.error('Errore caricamento statistiche:', err)
    }
  }

  const generateList = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/follow-up/generate', {
        method: 'POST'
      })
      const result = await response.json()

      if (result.success) {
        // Ricarica la lista aggiornata
        await loadCallList()
        setError(null)
      } else {
        throw new Error(result.error || 'Errore generazione lista')
      }
    } catch (err) {
      console.error('Errore generazione lista:', err)
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setIsLoading(false)
    }
  }

  const updateCall = async (callId: string, updateData: CallUpdateData) => {
    try {
      const response = await fetch(`/api/follow-up/calls/${callId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (result.success) {
        // Aggiorna la lista locale
        setCallList(prev => prev.map(call =>
          call.id === callId
            ? { ...call, ...updateData }
            : call
        ))

        // Ricarica le statistiche per riflettere i cambiamenti
        loadStatistics()
        setError(null)
      } else {
        throw new Error(result.error || 'Errore aggiornamento chiamata')
      }
    } catch (err) {
      console.error('Errore aggiornamento chiamata:', err)
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  const archiveCall = async (callId: string) => {
    try {
      const response = await fetch(`/api/follow-up/calls/${callId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        // Rimuovi dalla lista locale
        setCallList(prev => prev.filter(call => call.id !== callId))
        setError(null)
      } else {
        throw new Error(result.error || 'Errore archiviazione chiamata')
      }
    } catch (err) {
      console.error('Errore archiviazione chiamata:', err)
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return {
    callList,
    statistics,
    isLoading,
    error,
    generateList,
    updateCall,
    archiveCall,
    loadStatistics,
    refreshData: () => {
      loadCallList()
      loadStatistics()
    }
  }
}