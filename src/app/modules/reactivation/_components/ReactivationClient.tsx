'use client'

import { useState, useEffect } from 'react'
import { Download, Users, Calendar, UserX, RotateCcw, Mail, Phone, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DormantClient {
  id: string
  nome: string
  cognome: string
  email: string
  telefono: string
  genere: string | null
  ultimo_acquisto: string
  mesi_inattivo: number
  valore_totale: number
  numero_acquisti: number
  prodotti_preferiti: string[]
}

interface ReactivationCategory {
  id: string
  title: string
  description: string
  minMonths: number
  maxMonths: number
  color: string
  bgColor: string
  clients: DormantClient[]
  loading: boolean
}

export default function ReactivationClient() {
  const [categories, setCategories] = useState<ReactivationCategory[]>([
    {
      id: 'recent_inactive',
      title: 'Recenti Inattivi',
      description: '12-24 mesi dall\'ultimo acquisto',
      minMonths: 12,
      maxMonths: 24,
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 border-yellow-200',
      clients: [],
      loading: false
    },
    {
      id: 'moderate_inactive',
      title: 'Moderatamente Inattivi',
      description: '24-36 mesi dall\'ultimo acquisto',
      minMonths: 24,
      maxMonths: 36,
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 border-orange-200',
      clients: [],
      loading: false
    },
    {
      id: 'highly_inactive',
      title: 'Molto Inattivi',
      description: '36-48 mesi dall\'ultimo acquisto',
      minMonths: 36,
      maxMonths: 48,
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200',
      clients: [],
      loading: false
    },
    {
      id: 'dormant',
      title: 'Dormienti',
      description: 'Oltre 48 mesi dall\'ultimo acquisto',
      minMonths: 48,
      maxMonths: 999,
      color: 'text-gray-700',
      bgColor: 'bg-gray-50 border-gray-200',
      clients: [],
      loading: false
    }
  ])

  const supabase = createClient()

  const loadCategoryClients = async (categoryId: string) => {
    setCategories(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, loading: true } : cat
    ))

    try {
      const category = categories.find(c => c.id === categoryId)!

      // Calculate date ranges
      const minDate = new Date()
      minDate.setMonth(minDate.getMonth() - category.maxMonths)

      const maxDate = new Date()
      maxDate.setMonth(maxDate.getMonth() - category.minMonths)

      // Query for clients in this timeframe
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
            telefono,
            genere
          ),
          ordini_materiali(
            descrizione_prodotto
          ),
          info_pagamenti(
            prezzo_finale
          )
        `)
        .eq('stato_attuale', 'consegnato_pagato')
        .gte('data_apertura', minDate.toISOString())

      if (category.maxMonths !== 999) {
        query = query.lte('data_apertura', maxDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Group by client and find their last purchase
      const clientMap = new Map<string, DormantClient>()

      data?.forEach(busta => {
        const client = busta.clienti
        if (!client) return

        const clientId = client.id
        const infoPagamenti = busta.info_pagamenti as { prezzo_finale: number | null }[] | null
        const prezzo = infoPagamenti?.[0]?.prezzo_finale || 0

        if (!clientMap.has(clientId)) {
          // Calculate months since last purchase
          const lastPurchase = new Date(busta.data_apertura)
          const now = new Date()
          const monthsDiff = Math.floor((now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24 * 30))

          clientMap.set(clientId, {
            id: clientId,
            nome: client.nome,
            cognome: client.cognome,
            email: client.email || '',
            telefono: client.telefono || '',
            genere: client.genere,
            ultimo_acquisto: busta.data_apertura,
            mesi_inattivo: monthsDiff,
            valore_totale: 0,
            numero_acquisti: 0,
            prodotti_preferiti: []
          })
        }

        const existingClient = clientMap.get(clientId)!
        existingClient.valore_totale += prezzo
        existingClient.numero_acquisti += 1

        // Update last purchase date if more recent
        if (new Date(busta.data_apertura) > new Date(existingClient.ultimo_acquisto)) {
          existingClient.ultimo_acquisto = busta.data_apertura
        }

        // Add products
        busta.ordini_materiali?.forEach(ordine => {
          if (ordine.descrizione_prodotto &&
              !existingClient.prodotti_preferiti.includes(ordine.descrizione_prodotto)) {
            existingClient.prodotti_preferiti.push(ordine.descrizione_prodotto)
          }
        })
      })

      // Filter out clients who have made recent purchases (check against current activity)
      const dormantClients = Array.from(clientMap.values()).filter(client => {
        const monthsSinceLastPurchase = Math.floor(
          (new Date().getTime() - new Date(client.ultimo_acquisto).getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
        return monthsSinceLastPurchase >= category.minMonths &&
               (category.maxMonths === 999 || monthsSinceLastPurchase < category.maxMonths)
      })

      setCategories(prev => prev.map(cat =>
        cat.id === categoryId
          ? { ...cat, clients: dormantClients.sort((a, b) => b.valore_totale - a.valore_totale), loading: false }
          : cat
      ))

    } catch (error) {
      console.error(`Error loading ${categoryId} clients:`, error)
      setCategories(prev => prev.map(cat =>
        cat.id === categoryId ? { ...cat, loading: false } : cat
      ))
    }
  }

  const loadAllCategories = async () => {
    for (const category of categories) {
      await loadCategoryClients(category.id)
    }
  }

  const exportCategoryToCSV = (category: ReactivationCategory) => {
    if (category.clients.length === 0) return

    const headers = ['Nome', 'Cognome', 'Genere', 'Email', 'Telefono', 'Ultimo Acquisto', 'Mesi Inattivo', 'Valore Totale €', 'N° Acquisti', 'Prodotti Preferiti']

    const csvContent = [
      headers.join(','),
      ...category.clients.map(client => {
        const row = [
          client.nome,
          client.cognome,
          client.genere || '',
          client.email,
          client.telefono,
          new Date(client.ultimo_acquisto).toLocaleDateString('it-IT'),
          client.mesi_inattivo.toString(),
          client.valore_totale.toFixed(2),
          client.numero_acquisti.toString(),
          client.prodotti_preferiti.join('; ')
        ]

        return row.map(field => `"${field}"`).join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)

    const dateStr = new Date().toISOString().split('T')[0]
    link.download = `clienti_riattivazione_${category.id}_${dateStr}.csv`

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
            <h1 className="text-3xl font-bold text-gray-900">Riattivazione Clienti</h1>
            <p className="text-gray-600 mt-2">
              Clienti dormienti categorizzati per periodo di inattività - perfetti per campagne di riattivazione
            </p>
          </div>
        </div>
        <button
          onClick={loadAllCategories}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Aggiorna Tutte le Categorie
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map(category => (
          <div key={category.id} className={`border rounded-lg ${category.bgColor} overflow-hidden`}>
            {/* Category Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-semibold ${category.color}`}>
                    {category.title}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadCategoryClients(category.id)}
                    disabled={category.loading}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {category.loading ? 'Caricando...' : 'Carica'}
                  </button>
                  {category.clients.length > 0 && (
                    <button
                      onClick={() => exportCategoryToCSV(category)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      CSV ({category.clients.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {category.clients.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${category.color}`}>
                      {category.clients.length}
                    </div>
                    <div className="text-xs text-gray-600">Clienti</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${category.color}`}>
                      €{category.clients.reduce((sum, c) => sum + c.valore_totale, 0).toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-600">Valore Totale</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${category.color}`}>
                      €{category.clients.length > 0 ? (category.clients.reduce((sum, c) => sum + c.valore_totale, 0) / category.clients.length).toFixed(0) : '0'}
                    </div>
                    <div className="text-xs text-gray-600">Media Cliente</div>
                  </div>
                </div>
              )}
            </div>

            {/* Client List */}
            <div className="max-h-96 overflow-y-auto">
              {category.loading && (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Caricando clienti...</p>
                </div>
              )}

              {!category.loading && category.clients.length === 0 && (
                <div className="p-8 text-center">
                  <UserX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun cliente in questa categoria</h3>
                  <p className="text-gray-600">Clicca "Carica" per cercare clienti dormienti in questa fascia temporale.</p>
                </div>
              )}

              {category.clients.length > 0 && (
                <div className="divide-y divide-gray-200">
                  {category.clients.slice(0, 20).map(client => (
                    <div key={client.id} className="p-3 hover:bg-white hover:bg-opacity-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {client.nome} {client.cognome}
                            {client.genere && (
                              <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                {client.genere === 'M' ? 'Uomo' : 'Donna'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {client.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </div>
                            )}
                            {client.telefono && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.telefono}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(client.ultimo_acquisto).toLocaleDateString('it-IT')}
                              <span className="text-xs">({client.mesi_inattivo} mesi fa)</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className={`font-bold ${category.color}`}>
                            €{client.valore_totale.toFixed(2)}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {client.numero_acquisti} acquist{client.numero_acquisti !== 1 ? 'i' : 'o'}
                          </div>
                        </div>
                      </div>
                      {client.prodotti_preferiti.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Prodotti: </span>
                          {client.prodotti_preferiti.slice(0, 2).join(', ')}
                          {client.prodotti_preferiti.length > 2 && ` +${client.prodotti_preferiti.length - 2}`}
                        </div>
                      )}
                    </div>
                  ))}

                  {category.clients.length > 20 && (
                    <div className="p-3 text-center text-sm text-gray-500 bg-white bg-opacity-50">
                      Mostrando primi 20 di {category.clients.length} clienti. Esporta CSV per vedere tutti.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Riattivazione</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(category => (
            <div key={category.id} className={`${category.bgColor} rounded-lg p-4`}>
              <div className={`text-2xl font-bold ${category.color}`}>
                {category.clients.length}
              </div>
              <div className="text-sm text-gray-600">{category.title}</div>
              {category.clients.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  €{(category.clients.reduce((sum, c) => sum + c.valore_totale, 0) / category.clients.length).toFixed(0)} media
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}