'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, User, Package, Truck, ArrowLeft, Eye, ExternalLink, Archive, Clock, FileText, ChevronDown, ChevronUp, Calendar, AlertCircle, Phone, DollarSign, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  type: 'cliente' | 'prodotto' | 'fornitore' | 'categoria' | 'note';
  cliente?: {
    id: string;
    nome: string;
    cognome: string;
    telefono?: string | null;
    email?: string | null;
    genere?: string | null;
    note_cliente?: string | null;
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

interface Supplier {
  id: string;
  nome: string;
  category: string;
  categoryLabel: string;
}

export default function RicercaAvanzataPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'cliente' | 'prodotto' | 'fornitore' | 'note'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  // ===== NEW FILTERS =====
  const [showFilters, setShowFilters] = useState(false);
  const [bustaId, setBustaId] = useState('');
  const [priorita, setPriorita] = useState<'all' | 'normale' | 'urgente' | 'critica'>('all');
  const [tipoLavorazione, setTipoLavorazione] = useState<string>('all');
  const [fornitore, setFornitore] = useState<string>('all');
  const [categoria, setCategoria] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | '90' | '180' | '365' | 'custom'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [statoPagamento, setStatoPagamento] = useState<'all' | 'pagato' | 'non_pagato' | 'parziale' | 'saldo'>('all');
  const [statoOrdine, setStatoOrdine] = useState<'all' | 'da_ordinare' | 'ordinato' | 'in_arrivo' | 'in_ritardo' | 'arrivato' | 'accettato_con_riserva' | 'rifiutato' | 'sbagliato' | 'annullato'>('all');
  const [surveyParticipation, setSurveyParticipation] = useState<'all' | 'yes' | 'no'>('all');
  const [surveyBadge, setSurveyBadge] = useState<'all' | 'eccellente' | 'positivo' | 'attenzione' | 'critico'>('all');
  const [surveyScoreMode, setSurveyScoreMode] = useState<'avg' | 'latest'>('avg');
  const [surveyScoreMin, setSurveyScoreMin] = useState('');
  const [surveyLastFrom, setSurveyLastFrom] = useState('');
  const [surveyLastTo, setSurveyLastTo] = useState('');

  // ===== SUPPLIER DROPDOWN DATA =====
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Load suppliers on mount
  useEffect(() => {
    const loadSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const response = await fetch('/api/search/suppliers');
        if (response.ok) {
          const data = await response.json();
          setSuppliers(data.suppliers || []);
        }
      } catch (error) {
        console.error('Error loading suppliers:', error);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, []);

  const searchAdvanced = async () => {
    // Allow search with just filters (no text required)
    const hasFilters =
      bustaId ||
      priorita !== 'all' ||
      tipoLavorazione !== 'all' ||
      fornitore !== 'all' ||
      categoria !== 'all' ||
      dateRange !== 'all' ||
      telefono ||
      statoPagamento !== 'all' ||
      statoOrdine !== 'all' ||
      surveyParticipation !== 'all' ||
      surveyBadge !== 'all' ||
      surveyScoreMin ||
      surveyLastFrom ||
      surveyLastTo;

    if (!searchQuery.trim() && !hasFilters) {
      setResults([]);
      return;
    }

    if (searchQuery.trim() && searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      params.append('type', searchType);
      params.append('includeArchived', includeArchived.toString());

      // Add new filters
      if (bustaId) params.append('bustaId', bustaId);
      if (priorita !== 'all') params.append('priorita', priorita);
      if (tipoLavorazione !== 'all') params.append('tipoLavorazione', tipoLavorazione);
      if (fornitore !== 'all') params.append('fornitore', fornitore);
      if (categoria !== 'all') params.append('categoria', categoria);
      if (telefono) params.append('telefono', telefono);
      if (statoPagamento !== 'all') params.append('statoPagamento', statoPagamento);
      if (statoOrdine !== 'all') params.append('statoOrdine', statoOrdine);
      if (surveyParticipation !== 'all') params.append('surveyParticipation', surveyParticipation);
      if (surveyParticipation !== 'no' && surveyBadge !== 'all') params.append('surveyBadge', surveyBadge);
      if (surveyParticipation !== 'no' && surveyScoreMin.trim() !== '') {
        params.append('surveyScoreMode', surveyScoreMode);
        params.append('surveyScoreMin', surveyScoreMin.trim());
      }
      if (surveyParticipation !== 'no' && surveyLastFrom) params.append('surveyLastFrom', surveyLastFrom);
      if (surveyParticipation !== 'no' && surveyLastTo) params.append('surveyLastTo', surveyLastTo);

      // Calculate date range
      if (dateRange !== 'all' && dateRange !== 'custom') {
        const days = parseInt(dateRange);
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        params.append('dateFrom', from.toISOString().split('T')[0]);
        params.append('dateTo', to.toISOString().split('T')[0]);
      } else if (dateRange === 'custom' && dateFrom && dateTo) {
        params.append('dateFrom', dateFrom);
        params.append('dateTo', dateTo);
      }

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
      case 'cliente': return 'bg-blue-50/60 border-blue-200/60';
      case 'prodotto':
      case 'categoria': return 'bg-green-50/60 border-green-200/60';
      case 'fornitore': return 'bg-purple-50/60 border-purple-200/60';
      case 'note': return 'bg-yellow-50/60 border-yellow-200/60';
      default: return 'bg-slate-50/60 border-slate-200/60';
    }
  };

  const getDisplayType = (type: string) => {
    switch (type) {
      case 'categoria': return 'categoria prodotto';
      default: return type;
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--paper)] text-slate-900 kiasma-body overflow-hidden">
      <style jsx global>{`
        :root {
          --paper: #f6f1e9;
          --ink: #1b1f24;
          --teal: #0f6a6e;
          --copper: #b2734b;
        }
        .kiasma-hero {
          font-family: "DM Serif Display", "Iowan Old Style", "Times New Roman", serif;
        }
        .kiasma-body {
          font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,106,110,0.16),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(178,115,75,0.16),transparent_45%),radial-gradient(circle_at_60%_80%,rgba(15,106,110,0.1),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(120deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />

      {/* Header */}
      <div className="relative z-10 bg-white/80 border-b border-slate-200/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna alla Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-slate-300"></div>
            <div>
              <h1 className="kiasma-hero text-2xl text-[var(--ink)] flex items-center space-x-2">
                <Search className="h-6 w-6 text-[var(--teal)]" />
                <span>Ricerca Avanzata</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Cerca clienti, prodotti, fornitori o note in tutte le buste
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative z-10 p-6">
        <div className="bg-white/90 rounded-2xl border border-slate-200/80 p-6 mb-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.4)]">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Criteri di Ricerca</h2>
          
          {/* Search Input */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Termine opzionale (min. 2 caratteri se compilato)..."
                className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/30 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchAdvanced}
              disabled={isLoading}
              className="px-6 py-2 bg-[var(--ink)] text-[var(--paper)] rounded-md hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search className="w-4 h-4" />
              )}
              Cerca
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeArchived"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 text-[var(--teal)] border-slate-300 rounded focus:ring-[var(--teal)]/30"
              />
              <label htmlFor="includeArchived" className="text-sm text-slate-700 flex items-center gap-1">
                <Archive className="w-4 h-4" />
                Includi archiviate
              </label>
            </div>
          </div>

          {/* ===== EXPANDABLE ADVANCED FILTERS ===== */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--teal)] hover:text-[var(--ink)]"
            >
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showFilters ? 'Nascondi Filtri Avanzati' : 'Mostra Filtri Avanzati'}
            </button>

            {showFilters && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Search Type Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipo Ricerca
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutto</option>
                    <option value="cliente">Clienti</option>
                    <option value="prodotto">Prodotti</option>
                    <option value="fornitore">Fornitori</option>
                    <option value="note">Note</option>
                  </select>
                </div>

                {/* Busta ID Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ID Busta
                  </label>
                  <input
                    type="text"
                    value={bustaId}
                    onChange={(e) => setBustaId(e.target.value)}
                    placeholder="25-0001"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Priorità
                  </label>
                  <select
                    value={priorita}
                    onChange={(e) => setPriorita(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutte</option>
                    <option value="normale">Normale</option>
                    <option value="urgente">Urgente</option>
                    <option value="critica">Critica</option>
                  </select>
                </div>

                {/* Tipo Lavorazione Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipo Lavorazione
                  </label>
                  <select
                    value={tipoLavorazione}
                    onChange={(e) => setTipoLavorazione(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutti</option>
                    <option value="OCV">OCV</option>
                    <option value="OV">OV</option>
                    <option value="OS">OS</option>
                    <option value="LV">LV</option>
                    <option value="LS">LS</option>
                    <option value="LAC">LAC</option>
                    <option value="TALAC">TALAC</option>
                    <option value="ACC">ACC</option>
                    <option value="RIC">RIC</option>
                    <option value="LAB">LAB</option>
                    <option value="SA">SA</option>
                    <option value="SG">SG</option>
                    <option value="CT">CT</option>
                    <option value="ES">ES</option>
                    <option value="REL">REL</option>
                    <option value="FT">FT</option>
                    <option value="SPRT">SPRT</option>
                    <option value="VFT">VFT</option>
                    <option value="VC">VC</option>
                  </select>
                </div>

                {/* Product Category Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutte</option>
                    <option value="LENTI">Lenti</option>
                    <option value="LAC">LAC</option>
                    <option value="MONTATURE">Montature</option>
                    <option value="LABORATORIO">Laboratorio</option>
                    <option value="SPORT">Sport</option>
                    <option value="ACCESSORI">Accessori</option>
                    <option value="RICAMBI">Ricambi</option>
                    <option value="ASSISTENZA">Assistenza</option>
                  </select>
                </div>

                {/* Supplier Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Fornitore
                  </label>
                  <select
                    value={fornitore}
                    onChange={(e) => setFornitore(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loadingSuppliers}
                  >
                    <option value="all">Tutti</option>
                    {suppliers.length > 0 && (
                      <>
                        <optgroup label="Lenti">
                          {suppliers.filter(s => s.category === 'lenti').map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </optgroup>
                        <optgroup label="LAC">
                          {suppliers.filter(s => s.category === 'lac').map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Montature">
                          {suppliers.filter(s => s.category === 'montature').map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Laboratorio">
                          {suppliers.filter(s => s.category === 'lab_esterno').map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Sport">
                          {suppliers.filter(s => s.category === 'sport').map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>

                {/* Telefono */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Telefono
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="335..."
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Stato Pagamento */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pagamento
                  </label>
                  <select
                    value={statoPagamento}
                    onChange={(e) => setStatoPagamento(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutti</option>
                    <option value="pagato">Pagato</option>
                    <option value="non_pagato">Non Pagato</option>
                    <option value="parziale">Parziale</option>
                    <option value="saldo">Saldo da Versare</option>
                  </select>
                </div>

                {/* Stato Ordine */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Stato Ordine
                  </label>
                  <select
                    value={statoOrdine}
                    onChange={(e) => setStatoOrdine(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutti</option>
                    <option value="da_ordinare">Da Ordinare</option>
                    <option value="ordinato">Ordinato</option>
                    <option value="in_arrivo">In Arrivo</option>
                    <option value="in_ritardo">In Ritardo</option>
                    <option value="arrivato">Arrivato</option>
                    <option value="accettato_con_riserva">Con Riserva</option>
                    <option value="rifiutato">Rifiutato</option>
                    <option value="sbagliato">Sbagliato</option>
                    <option value="annullato">Annullato</option>
                  </select>
                </div>

                {/* Date Range Filter - spanning 2 columns */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Periodo
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={dateRange}
                      onChange={(e) => {
                        setDateRange(e.target.value as any);
                        if (e.target.value !== 'custom') {
                          setDateFrom('');
                          setDateTo('');
                        }
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Tutto</option>
                      <option value="7">7gg</option>
                      <option value="30">30gg</option>
                      <option value="90">90gg</option>
                      <option value="180">180gg</option>
                      <option value="365">1anno</option>
                      <option value="custom">Custom</option>
                    </select>

                    {dateRange === 'custom' && (
                      <>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Survey Participation */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Survey
                  </label>
                  <select
                    value={surveyParticipation}
                    onChange={(e) => setSurveyParticipation(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tutti</option>
                    <option value="yes">Ha partecipato</option>
                    <option value="no">Non ha partecipato</option>
                  </select>
                </div>

                {/* Survey Badge */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Badge Survey
                  </label>
                  <select
                    value={surveyBadge}
                    onChange={(e) => setSurveyBadge(e.target.value as any)}
                    disabled={surveyParticipation === 'no'}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="all">Tutti</option>
                    <option value="eccellente">Eccellente</option>
                    <option value="positivo">Positivo</option>
                    <option value="attenzione">Attenzione</option>
                    <option value="critico">Critico</option>
                  </select>
                </div>

                {/* Survey Score */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Score Survey Minimo
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={surveyScoreMode}
                      onChange={(e) => setSurveyScoreMode(e.target.value as any)}
                      disabled={surveyParticipation === 'no'}
                      className="w-40 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="avg">Media</option>
                      <option value="latest">Ultimo</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={surveyScoreMin}
                      onChange={(e) => setSurveyScoreMin(e.target.value)}
                      disabled={surveyParticipation === 'no'}
                      placeholder="es. 85"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Survey Date Range */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Ultima risposta survey (da/a)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={surveyLastFrom}
                      onChange={(e) => setSurveyLastFrom(e.target.value)}
                      disabled={surveyParticipation === 'no'}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <input
                      type="date"
                      value={surveyLastTo}
                      onChange={(e) => setSurveyLastTo(e.target.value)}
                      disabled={surveyParticipation === 'no'}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}
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

              {/* Cliente Result - CLICKABLE */}
              {result.type === 'cliente' && result.cliente && (
                <div>
                  <Link
                    href={`/dashboard/clienti/${result.cliente.id}`}
                    className="block group hover:bg-gray-50 rounded-lg p-3 -m-3 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {result.cliente.nome} {result.cliente.cognome}
                      </h3>
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      {result.cliente.telefono && (
                        <span className="flex items-center gap-1">
                          <span role="img" aria-label="Telefono">📞</span>
                          <span>{result.cliente.telefono}</span>
                        </span>
                      )}
                      {result.cliente.email && (
                        <span className="flex items-center gap-1">
                          <span role="img" aria-label="Email">✉️</span>
                          <span>{result.cliente.email}</span>
                        </span>
                      )}
                      {result.cliente.genere && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 uppercase tracking-wide">
                          {result.cliente.genere}
                        </span>
                      )}
                    </div>
                    {result.cliente.note_cliente && (
                      <p className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-2">
                        {result.cliente.note_cliente}
                      </p>
                    )}
                  </Link>
                  
                  {result.buste && result.buste.length > 0 ? (
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
                  ) : (
                    <p className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3 text-gray-400" />
                      Nessuna busta associata a questo cliente al momento.
                    </p>
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
