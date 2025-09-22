'use client'

import { useState, useEffect } from 'react'
import { Download, Filter, Users, Mail, Calendar, Search, DollarSign, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FilteredClient {
  id: string
  nome: string
  cognome: string
  email: string
  telefono: string
  ultimo_acquisto: string
  prodotti_acquistati: string[]
  valore_totale: number
  numero_acquisti: number
}

interface MarketingFilters {
  brand: string
  timeframe: string
  minAmount: string
  maxAmount: string
  includeEmail: boolean
  includePhone: boolean
}

export default function MarketingClient() {
  const [filters, setFilters] = useState<MarketingFilters>({
    brand: '',
    timeframe: '12',
    minAmount: '',
    maxAmount: '',
    includeEmail: true,
    includePhone: false
  })

  const [clients, setClients] = useState<FilteredClient[]>([])
  const [loading, setLoading] = useState(false)
  const [brands, setBrands] = useState<string[]>([])

  const supabase = createClient()

  // Load available brands from database
  useEffect(() => {
    loadBrands()
  }, [])

  const loadBrands = async () => {
    try {
      // Load brands from all supplier tables
      const [montatureRes, lentiRes, lacRes, sportRes, labRes] = await Promise.all([
        supabase.from('fornitori_montature').select('nome'),
        supabase.from('fornitori_lenti').select('nome'),
        supabase.from('fornitori_lac').select('nome'),
        supabase.from('fornitori_sport').select('nome'),
        supabase.from('fornitori_lab_esterno').select('nome')
      ])

      // Check for errors
      if (montatureRes.error) throw montatureRes.error
      if (lentiRes.error) throw lentiRes.error
      if (lacRes.error) throw lacRes.error
      if (sportRes.error) throw sportRes.error
      if (labRes.error) throw labRes.error

      // Combine all supplier names
      const allSuppliers = [
        ...(montatureRes.data || []),
        ...(lentiRes.data || []),
        ...(lacRes.data || []),
        ...(sportRes.data || []),
        ...(labRes.data || [])
      ]

      // Get unique brand names
      const brandsSet = new Set(
        allSuppliers.map(supplier => supplier.nome).filter(Boolean)
      )
      const uniqueBrands = Array.from(brandsSet).sort((a, b) => a.localeCompare(b))

      setBrands(uniqueBrands)
    } catch (error) {
      console.error('Error loading brands:', error)
    }
  }

  const searchClients = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('buste')
        .select(`
          id,
          cliente_id,
          data_apertura,
          clienti!inner(
            id,
            nome,
            cognome,
            email,
            telefono
          ),
          ordini_materiali!inner(
            descrizione_prodotto,
            data_ordine,
            fornitore_montature_id,
            fornitore_lenti_id,
            fornitore_lac_id,
            fornitore_sport_id,
            fornitore_lab_esterno_id,
            fornitori_montature(nome),
            fornitori_lenti(nome),
            fornitori_lac(nome),
            fornitori_sport(nome),
            fornitori_lab_esterno(nome)
          ),
          info_pagamenti(
            prezzo_finale
          )
        `)
        .eq('stato_attuale', 'consegnato_pagato')

      // Date filter
      if (filters.timeframe !== 'all') {
        const monthsAgo = new Date()
        monthsAgo.setMonth(monthsAgo.getMonth() - Number.parseInt(filters.timeframe))
        query = query.gte('data_apertura', monthsAgo.toISOString())
      }

      // Brand filter - we'll filter in JavaScript after getting results since we need to check multiple supplier tables
      // This is more flexible than trying to create complex SQL joins for all supplier types

      const { data, error } = await query

      if (error) throw error

      // Group by client and calculate totals
      const clientMap = new Map<string, FilteredClient>()

      data?.forEach(busta => {
        const client = busta.clienti
        if (!client) return

        // Apply brand filter by checking supplier names
        if (filters.brand) {
          const hasMatchingBrand = busta.ordini_materiali?.some(ordine => {
            const supplierNames = [
              ordine.fornitori_montature?.nome,
              ordine.fornitori_lenti?.nome,
              ordine.fornitori_lac?.nome,
              ordine.fornitori_sport?.nome,
              ordine.fornitori_lab_esterno?.nome
            ].filter(Boolean)

            return supplierNames.some(nome => nome === filters.brand)
          })

          if (!hasMatchingBrand) return
        }

        const clientId = client.id
        const infoPagamenti = busta.info_pagamenti as { prezzo_finale: number | null }[] | null
        const prezzo = infoPagamenti?.[0]?.prezzo_finale || 0

        // Skip if price filters don't match
        if (filters.minAmount && prezzo < Number.parseFloat(filters.minAmount)) return
        if (filters.maxAmount && prezzo > Number.parseFloat(filters.maxAmount)) return

        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            id: clientId,
            nome: client.nome,
            cognome: client.cognome,
            email: client.email || '',
            telefono: client.telefono || '',
            ultimo_acquisto: busta.data_apertura,
            prodotti_acquistati: [],
            valore_totale: 0,
            numero_acquisti: 0
          })
        }

        const existingClient = clientMap.get(clientId)!
        existingClient.valore_totale += prezzo
        existingClient.numero_acquisti += 1

        // Add products
        busta.ordini_materiali?.forEach(ordine => {
          if (ordine.descrizione_prodotto &&
              !existingClient.prodotti_acquistati.includes(ordine.descrizione_prodotto)) {
            existingClient.prodotti_acquistati.push(ordine.descrizione_prodotto)
          }
        })

        // Update last purchase date if more recent
        if (new Date(busta.data_apertura) > new Date(existingClient.ultimo_acquisto)) {
          existingClient.ultimo_acquisto = busta.data_apertura
        }
      })

      setClients(Array.from(clientMap.values()).sort((a, b) =>
        new Date(b.ultimo_acquisto).getTime() - new Date(a.ultimo_acquisto).getTime()
      ))

    } catch (error) {
      console.error('Error searching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (clients.length === 0) return

    // Filter fields based on privacy settings
    const headers = ['Nome', 'Cognome']
    if (filters.includeEmail) headers.push('Email')
    if (filters.includePhone) headers.push('Telefono')
    headers.push('Ultimo Acquisto', 'Prodotti', 'Valore Totale €', 'N° Acquisti')

    const csvContent = [
      headers.join(','),
      ...clients.map(client => {
        const row = [
          client.nome,
          client.cognome
        ]
        if (filters.includeEmail) row.push(client.email || '')
        if (filters.includePhone) row.push(client.telefono || '')

        row.push(
          new Date(client.ultimo_acquisto).toLocaleDateString('it-IT'),
          client.prodotti_acquistati.join('; '),
          client.valore_totale.toFixed(2),
          client.numero_acquisti.toString()
        )

        return row.map(field => `"${field}"`).join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)

    const dateStr = new Date().toISOString().split('T')[0]
    const brandStr = filters.brand ? `_${filters.brand}` : ''
    link.download = `clienti_marketing_${dateStr}${brandStr}.csv`

    link.click()
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/dashboard"
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </a>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketing Clienti</h1>
            <p className="text-gray-600 mt-2">
              Filtra clienti per campagne marketing mirate basate sullo storico acquisti
            </p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">Filtri di Ricerca</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Brand Filter */}
            <div className="space-y-2">
              <label htmlFor="brand-filter" className="block text-sm font-medium text-gray-700">Marca</label>
              <select
                id="brand-filter"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.brand}
                onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
              >
                <option value="">Tutte le marche</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
              <label htmlFor="timeframe-filter" className="block text-sm font-medium text-gray-700">Periodo</label>
              <select
                id="timeframe-filter"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.timeframe}
                onChange={(e) => setFilters(prev => ({ ...prev, timeframe: e.target.value }))}
              >
                <option value="all">Tutti i clienti</option>
                <option value="6">Ultimi 6 mesi</option>
                <option value="12">Ultimi 12 mesi</option>
                <option value="24">Ultimi 2 anni</option>
                <option value="36">Ultimi 3 anni</option>
              </select>
            </div>

            {/* Min Amount */}
            <div className="space-y-2">
              <label htmlFor="min-amount-filter" className="block text-sm font-medium text-gray-700">Spesa Minima €</label>
              <input
                id="min-amount-filter"
                type="number"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.minAmount}
                onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
              />
            </div>

            {/* Max Amount */}
            <div className="space-y-2">
              <label htmlFor="max-amount-filter" className="block text-sm font-medium text-gray-700">Spesa Massima €</label>
              <input
                id="max-amount-filter"
                type="number"
                placeholder="Nessun limite"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.maxAmount}
                onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
              />
            </div>
          </div>

          {/* Privacy Options */}
          <div className="flex gap-6 py-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <input
                id="includeEmail"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={filters.includeEmail}
                onChange={(e) => setFilters(prev => ({ ...prev, includeEmail: e.target.checked }))}
              />
              <label htmlFor="includeEmail" className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="h-4 w-4" />
                Includi Email nell'export
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="includePhone"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={filters.includePhone}
                onChange={(e) => setFilters(prev => ({ ...prev, includePhone: e.target.checked }))}
              />
              <label htmlFor="includePhone" className="flex items-center gap-2 text-sm text-gray-700">
                <Users className="h-4 w-4" />
                Includi Telefono nell'export
              </label>
            </div>
          </div>

          {/* Search Button */}
          <div className="flex gap-3">
            <button
              onClick={searchClients}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Cercando...' : 'Cerca Clienti'}
            </button>
            {clients.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Esporta CSV ({clients.length} clienti)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {clients.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              Risultati ({clients.length} clienti trovati)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contatti</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Ultimo Acquisto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Prodotti</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Valore Totale</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">N° Acquisti</th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 50).map(client => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {client.nome} {client.cognome}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {client.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</div>}
                      {client.telefono && <div className="flex items-center gap-1 mt-1"><Users className="h-3 w-3" />{client.telefono}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {new Date(client.ultimo_acquisto).toLocaleDateString('it-IT')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                      <div className="truncate" title={client.prodotti_acquistati.join(', ')}>
                        {client.prodotti_acquistati.slice(0, 2).join(', ')}
                        {client.prodotti_acquistati.length > 2 && ` +${client.prodotti_acquistati.length - 2}`}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        €{client.valore_totale.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 font-medium">
                      {client.numero_acquisti}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clients.length > 50 && (
              <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-100 mt-4">
                Mostrando primi 50 risultati di {clients.length}. Usa l'export per vedere tutti.
              </div>
            )}
          </div>
        </div>
      )}

      {/* No results message */}
      {!loading && clients.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun cliente trovato</h3>
          <p className="text-gray-600">
            Prova a modificare i filtri di ricerca per trovare clienti che corrispondono ai tuoi criteri.
          </p>
        </div>
      )}
    </div>
  )
}