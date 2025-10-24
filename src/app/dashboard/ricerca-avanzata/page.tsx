'use client';

import { useState } from 'react';
import { Search, Filter, User, Package, Truck, ArrowLeft, Eye, ExternalLink, Archive, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  type: 'cliente' | 'prodotto' | 'fornitore' | 'categoria' | 'note';
  cliente?: {
    id: string;
    nome: string;
    cognome: string;
    telefono?: string;
    email?: string;
  };
  buste?: Array<{
    id: string;
    readable_id: string;
    stato_attuale: string;
    data_apertura: string;
    isArchived?: boolean;
  }>;
  busta?: {
    id: string;
    readable_id: string;
    stato_attuale: string;
    data_apertura: string;
    isArchived?: boolean;
  };
  prodotto?: {
    id: string;
    descrizione: string;
    codice?: string;
    categoria?: string;
    fornitore?: string;
    note?: string;
    stato?: string;
  };
  categoria?: string;
  fornitore?: {
    nome: string;
    categoria: string;
    telefono?: string;
    email?: string;
    tempi_consegna_medi?: number;
  };
  ordine?: {
    id: string;
    descrizione: string;
    stato: string;
    data_ordine?: string;
    note?: string;
  };
  materiale?: {
    id?: string;
    tipo: string;
    stato?: string;
    note?: string;
  };
  matchField: string;
  // For notes search
  note?: string;
  source?: string;
  sourceIcon?: string;
  metadata?: string;
}

export default function RicercaAvanzataPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'cliente' | 'prodotto' | 'fornitore' | 'note'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const searchAdvanced = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        type: searchType,
        includeArchived: includeArchived.toString()
      });

      // Use notes endpoint if searching notes specifically
      const endpoint = searchType === 'note'
        ? `/api/search/notes?${params}`
        : `/api/search/advanced?${params}`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setTotalResults(data.total || 0);
      }
    } catch (error) {
      console.error('Error in advanced search:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchAdvanced();
    }
  };

  const getBustaStatusText = (stato: string) => {
    switch (stato) {
      case 'nuove': return 'Nuova';
      case 'materiali_ordinati': return 'Materiali Ordinati';
      case 'materiali_parzialmente_arrivati': return 'Materiali Parziali';
      case 'materiali_arrivati': return 'Materiali Arrivati';
      case 'in_lavorazione': return 'In Lavorazione';
      case 'pronto_ritiro': return 'Pronto Ritiro';
      case 'consegnato_pagato': return 'Consegnato';
      default: return stato;
    }
  };

  const getBustaStatusColor = (stato: string, isArchived?: boolean) => {
    if (isArchived) return 'bg-gray-100 text-gray-600';
    
    switch (stato) {
      case 'nuove': return 'bg-blue-100 text-blue-800';
      case 'materiali_ordinati': return 'bg-yellow-100 text-yellow-800';
      case 'materiali_parzialmente_arrivati': return 'bg-orange-100 text-orange-800';
      case 'materiali_arrivati': return 'bg-purple-100 text-purple-800';
      case 'in_lavorazione': return 'bg-indigo-100 text-indigo-800';
      case 'pronto_ritiro': return 'bg-green-100 text-green-800';
      case 'consegnato_pagato': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cliente': return <User className="w-4 h-4" />;
      case 'prodotto':
      case 'categoria': return <Package className="w-4 h-4" />;
      case 'fornitore': return <Truck className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cliente': return 'bg-blue-50 border-blue-200';
      case 'prodotto':
      case 'categoria': return 'bg-green-50 border-green-200';
      case 'fornitore': return 'bg-purple-50 border-purple-200';
      case 'note': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getDisplayType = (type: string) => {
    switch (type) {
      case 'categoria': return 'categoria prodotto';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna alla Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Search className="h-6 w-6 text-blue-600" />
                <span>Ricerca Avanzata</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Cerca clienti, prodotti, fornitori o note in tutte le buste
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Criteri di Ricerca</h2>
          
          {/* Search Input */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Inserisci termine di ricerca (min. 2 caratteri)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchAdvanced}
              disabled={isLoading || searchQuery.trim().length < 2}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search className="w-4 h-4" />
              )}
              Cerca
            </button>
          </div>

          {/* Search Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Tipo:</span>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutto</option>
                <option value="cliente">Solo Clienti</option>
                <option value="prodotto">Solo Prodotti</option>
                <option value="fornitore">Solo Fornitori</option>
                <option value="note">Solo Note</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeArchived"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="includeArchived" className="text-sm text-gray-700 flex items-center gap-1">
                <Archive className="w-4 h-4" />
                Includi archiviate
              </label>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {totalResults > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Trovati <span className="font-semibold">{totalResults}</span> risultati
              {totalResults > 50 && " (mostrati i primi 50)"}
            </p>
          </div>
        )}

        {/* Results List */}
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index} className={`bg-white rounded-lg border p-4 ${getTypeColor(result.type)}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getTypeIcon(result.type)}
                  <span className="font-semibold text-gray-900 capitalize">{getDisplayType(result.type)}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {result.matchField}
                  </span>
                </div>
              </div>

              {/* Cliente Result */}
              {result.type === 'cliente' && result.cliente && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    {result.cliente.nome} {result.cliente.cognome}
                  </h3>
                  {result.cliente.telefono && (
                    <p className="text-sm text-gray-600">📞 {result.cliente.telefono}</p>
                  )}
                  
                  {result.buste && result.buste.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Buste ({result.buste.length}):</p>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {result.buste.slice(0, 6).map((busta) => (
                          <div key={busta.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{busta.readable_id}</span>
                                {busta.isArchived && <Archive className="w-3 h-3 text-gray-500" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${getBustaStatusColor(busta.stato_attuale, busta.isArchived)}`}>
                                  {getBustaStatusText(busta.stato_attuale)}
                                </span>
                              </div>
                            </div>
                            <Link
                              href={`/dashboard/buste/${busta.id}`}
                              className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                              title="Visualizza busta"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        ))}
                      </div>
                      {result.buste.length > 6 && (
                        <p className="text-xs text-gray-500 mt-2">
                          ... e altre {result.buste.length - 6} buste
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prodotto Result */}
              {result.type === 'prodotto' && result.prodotto && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    {result.prodotto.descrizione}
                  </h3>
                  {result.prodotto.codice && (
                    <p className="text-sm text-gray-600">Codice: {result.prodotto.codice}</p>
                  )}
                  {result.prodotto.categoria && (
                    <p className="text-sm text-gray-600">Categoria: {result.prodotto.categoria}</p>
                  )}
                  {result.prodotto.fornitore && (
                    <p className="text-sm text-gray-600">Fornitore: {result.prodotto.fornitore}</p>
                  )}

                  {result.busta && result.cliente && (
                    <div className="mt-3 bg-gray-50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Busta {result.busta.readable_id}
                            {result.busta.isArchived && <Archive className="w-3 h-3 text-gray-500 inline ml-1" />}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cliente: {result.cliente.nome} {result.cliente.cognome}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded ${getBustaStatusColor(result.busta.stato_attuale, result.busta.isArchived)}`}>
                            {getBustaStatusText(result.busta.stato_attuale)}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/buste/${result.busta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Visualizza busta"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Categoria Result */}
              {result.type === 'categoria' && result.categoria && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    Categoria: {result.categoria}
                  </h3>
                  {result.prodotto && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">Prodotto ordinato:</p>
                      <p className="font-medium text-gray-800">{result.prodotto.descrizione}</p>
                      {result.prodotto.stato && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {result.prodotto.stato}
                        </span>
                      )}
                    </div>
                  )}

                  {result.busta && result.cliente && (
                    <div className="mt-3 bg-gray-50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Busta {result.busta.readable_id}
                            {result.busta.isArchived && <Archive className="w-3 h-3 text-gray-500 inline ml-1" />}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cliente: {result.cliente.nome} {result.cliente.cognome}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded ${getBustaStatusColor(result.busta.stato_attuale, result.busta.isArchived)}`}>
                            {getBustaStatusText(result.busta.stato_attuale)}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/buste/${result.busta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Visualizza busta"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fornitore Result */}
              {result.type === 'fornitore' && result.fornitore && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    Fornitore: {result.fornitore.nome}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-2">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                      {result.fornitore.categoria}
                    </span>
                    {result.fornitore.telefono && (
                      <span>📞 {result.fornitore.telefono}</span>
                    )}
                    {result.fornitore.tempi_consegna_medi && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {result.fornitore.tempi_consegna_medi} giorni
                      </span>
                    )}
                  </div>

                  {/* Mostra ordine o materiale */}
                  {result.ordine && (
                    <div className="mb-3 bg-blue-50 rounded p-2">
                      <p className="text-sm text-gray-600 mb-1">Ordine:</p>
                      <p className="font-medium text-gray-800">{result.ordine.descrizione}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {result.ordine.stato}
                        </span>
                        {result.ordine.data_ordine && (
                          <span className="text-xs text-gray-500">
                            {formatDate(result.ordine.data_ordine)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {result.materiale && !result.ordine && (
                    <div className="mb-3 bg-green-50 rounded p-2">
                      <p className="text-sm text-gray-600 mb-1">Materiale:</p>
                      <p className="font-medium text-gray-800">{result.materiale.tipo}</p>
                      {result.materiale.stato && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          {result.materiale.stato}
                        </span>
                      )}
                    </div>
                  )}

                  {result.busta && result.cliente && (
                    <div className="mt-3 bg-gray-50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Busta {result.busta.readable_id}
                            {result.busta.isArchived && <Archive className="w-3 h-3 text-gray-500 inline ml-1" />}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cliente: {result.cliente.nome} {result.cliente.cognome}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded ${getBustaStatusColor(result.busta.stato_attuale, result.busta.isArchived)}`}>
                            {getBustaStatusText(result.busta.stato_attuale)}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/buste/${result.busta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Visualizza busta"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Note Result */}
              {result.type === 'note' && result.note && (
                <div>
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                        {result.source}
                      </span>
                      {result.metadata && (
                        <span className="text-xs text-gray-500">• {result.metadata}</span>
                      )}
                    </div>
                    <div className="bg-white rounded-lg border border-gray-300 p-3">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{result.note}</p>
                    </div>
                  </div>

                  {result.busta && result.cliente && (
                    <div className="mt-3 bg-gray-50 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Busta {result.busta.readable_id}
                            {result.busta.isArchived && <Archive className="w-3 h-3 text-gray-500 inline ml-1" />}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cliente: {result.cliente.nome} {result.cliente.cognome}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded ${getBustaStatusColor(result.busta.stato_attuale, result.busta.isArchived)}`}>
                              {getBustaStatusText(result.busta.stato_attuale)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(result.busta.data_apertura)}
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/buste/${result.busta.id}`}
                          className="p-2 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Visualizza busta"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {searchQuery.trim().length >= 2 && !isLoading && results.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun risultato trovato</h3>
              <p className="text-gray-500">
                Prova a modificare i termini di ricerca o i filtri.
              </p>
            </div>
          )}

          {searchQuery.trim().length < 2 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Inizia una ricerca</h3>
              <p className="text-gray-500">
                Inserisci almeno 2 caratteri per iniziare la ricerca.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}