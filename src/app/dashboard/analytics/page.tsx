'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Activity, TrendingUp, Package, AlertCircle, Euro, Calendar, Tag, Eye, ArrowUp, ArrowLeft, Filter, Clock, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
  tipo_lavorazione: { stats: Record<string, number>; total: number };
  tipo_lenti: { stats: Record<string, number>; total: number };
  classificazione_lenti?: { stats: Record<string, number>; total: number };
  trattamenti?: {
    stats: Record<string, number>;
    total: number;
    orders_with_trattamenti: number;
    by_tipo_lenti: Record<string, Record<string, number>>;
  };
  brands: {
    all: Record<string, number>;
  };
  gender: { stats: Record<string, number> };
  warranty: { total: number };
  trends: {
    monthly: Array<{
      month: string;
      total: number;
      OCV: number;
      OV: number;
      LAC: number;
      OS: number;
    }>;
  };
  revenue: {
    total: number;
    acconti: number;
    saldati: number;
    average: number;
    by_tipo: Record<string, { total: number; count: number; avg: number }>;
  };
  lens_delivery_times?: {
    types: string[];
    by_supplier: Array<{
      supplier: string;
      total_orders: number;
      avg_days: number | null;
      by_tipo: Record<string, { avg_days: number | null; count: number } | null>;
    }>;
  };
  busta_lead_times?: {
    start_date: string;
    total: number;
    by_tipo: Array<{ tipo: string; avg_days: number | null; count: number }>;
  };
  payment_types?: { stats: Record<string, number>; total: number };
  acconti?: { with_acconto: number; total: number; percent: number };
  ambassador?: {
    totale: number;
    by_fonte: Record<string, { totale: number; ultimi_30gg: number }>;
    recensioni_richieste: number;
    link_inviati: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeSection, setActiveSection] = useState<'panoramica' | 'lenti' | 'tempi' | 'pagamenti' | 'ambassador'>('panoramica');

  useEffect(() => {
    fetchAnalytics();
  }, [period, startDate, endDate]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) setData(result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium">Caricamento analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-semibold text-lg">Errore nel caricamento dei dati</p>
        </div>
      </div>
    );
  }

  const tipoLavorazioneData = Object.entries(data.tipo_lavorazione.stats).map(([name, value]) => ({ name, value }));
  const topBrands = Object.entries(data.brands.all).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  const topBrandMax = topBrands[0]?.value ?? 1;
  const classificazioneMax = data.classificazione_lenti
    ? Math.max(...Object.values(data.classificazione_lenti.stats), 1)
    : 1;
  const revenueData = Object.entries(data.revenue.by_tipo).map(([tipo, stats]) => ({ tipo, revenue: stats.total, count: stats.count, avg: stats.avg })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const lensDeliveryTypes = data.lens_delivery_times?.types ?? [];
  const lensDeliveryRows = data.lens_delivery_times?.by_supplier ?? [];
  const leadTimeRows = data.busta_lead_times?.by_tipo ?? [];
  const paymentTypeStats = data.payment_types?.stats ?? {};
  const paymentTypeData = Object.entries(paymentTypeStats)
    .filter(([key, value]) => key !== 'non_classificato' && value > 0)
    .map(([key, value]) => ({
      name: key === 'saldo_unico'
        ? 'Saldo unico'
        : key === 'installments'
          ? 'Rateizzazione interna'
          : 'Finanziamento bancario',
      value
    }));
  const paymentTypeUnknown = paymentTypeStats.non_classificato ?? 0;

  const analyticsSections = [
    { key: 'panoramica' as const, label: 'Panoramica' },
    { key: 'lenti' as const, label: 'Lenti & Fornitori' },
    { key: 'tempi' as const, label: 'Tempi & Workflow' },
    { key: 'pagamenti' as const, label: 'Pagamenti' },
    { key: 'ambassador' as const, label: 'Ambassador & Recensioni' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Torna alla Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Business Intelligence</h1>
                <p className="text-sm text-slate-500">Analisi vendite e performance</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 bg-white rounded-xl p-2 shadow-sm border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400 ml-2" />
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer">
                <option value="month">Questo Mese</option>
                <option value="quarter">Trimestre</option>
                <option value="year">Anno</option>
                <option value="custom">Custom</option>
              </select>
              {period === 'custom' && (
                <>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-500">Ordini Totali</p>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-4xl font-bold text-slate-900">{data.tipo_lavorazione.total}</p>
              <div className="flex items-center mt-2 text-xs">
                <ArrowUp className="w-3 h-3 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">Periodo selezionato</span>
              </div>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-500">Lenti Ordinate</p>
                <Eye className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-4xl font-bold text-slate-900">{data.tipo_lenti.total}</p>
              <p className="text-xs text-slate-400 mt-2">Livelli di qualità</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-500">Garanzie</p>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-4xl font-bold text-slate-900">{data.warranty.total}</p>
              <p className="text-xs text-slate-400 mt-2">Sostituzioni in garanzia</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-500">Fatturato</p>
                <Euro className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-4xl font-bold text-slate-900">€{(data.revenue.total / 1000).toFixed(1)}k</p>
              <p className="text-xs text-slate-400 mt-2">Media: €{data.revenue.average.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {analyticsSections.map(section => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                activeSection === section.key
                  ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                  : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === 'panoramica' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Tipo Lavorazione</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={tipoLavorazioneData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={(entry: any) => `${entry.name}`}>
                      {tipoLavorazioneData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Trend Mensile</h3>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.trends.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} name="Totale" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="OCV" stroke="#10b981" strokeWidth={2} name="OCV" />
                    <Line type="monotone" dataKey="OV" stroke="#f59e0b" strokeWidth={2} name="OV" />
                    <Line type="monotone" dataKey="LAC" stroke="#8b5cf6" strokeWidth={2} name="LAC" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Tag className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Top Fornitori</h3>
                </div>
                <div className="space-y-3">
                  {topBrands.length > 0 ? (
                    topBrands.map((brand, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{brand.name}</span>
                            <span className="text-sm font-bold text-slate-900">{brand.value}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(brand.value / topBrandMax) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">Nessun dato disponibile</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeSection === 'lenti' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Categoria Lenti */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Categoria Lenti</h3>
                </div>
                {Object.keys(data.tipo_lenti.stats).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.tipo_lenti.stats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([nome, count], idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">{nome}</span>
                              <span className="text-sm font-bold text-slate-900">{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${(count / Math.max(...Object.values(data.tipo_lenti.stats))) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400">Nessun dato</div>
                )}
              </div>

              {/* Classificazione Lenti */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Filter className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Classificazione Lenti</h3>
                </div>
                {data.classificazione_lenti && Object.keys(data.classificazione_lenti.stats).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.classificazione_lenti.stats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([nome, count], idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">{nome}</span>
                              <span className="text-sm font-bold text-slate-900">{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${(count / classificazioneMax) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400">Nessun dato</div>
                )}
              </div>

              {/* Trattamenti */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Tag className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Trattamenti Lenti</h3>
                  {data.trattamenti && (
                    <span className="text-xs text-slate-500 ml-auto">
                      {data.trattamenti.orders_with_trattamenti} ordini con trattamenti
                    </span>
                  )}
                </div>
                {data.trattamenti && Object.keys(data.trattamenti.stats).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.trattamenti.stats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([nome, count], idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">{nome}</span>
                              <span className="text-sm font-bold text-slate-900">{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${(count / Math.max(...Object.values(data.trattamenti!.stats))) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400">Nessun dato sui trattamenti</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Tempi medi consegna lenti per fornitore</h3>
                </div>
                <span className="text-xs text-slate-500">Calcolo su ordini arrivati nel periodo selezionato</span>
              </div>
              {lensDeliveryRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-xs">
                        <th className="px-3 py-2 text-left">Fornitore</th>
                        {lensDeliveryTypes.map(tipo => (
                          <th key={tipo} className="px-3 py-2 text-left">{tipo}</th>
                        ))}
                        <th className="px-3 py-2 text-left">Media Totale</th>
                        <th className="px-3 py-2 text-left">Ordini</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lensDeliveryRows.map((row, idx) => (
                        <tr key={`${row.supplier}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">{row.supplier}</td>
                          {lensDeliveryTypes.map(tipo => {
                            const record = row.by_tipo[tipo];
                            return (
                              <td key={`${row.supplier}-${tipo}`} className="px-3 py-2 text-slate-700">
                                {record && record.avg_days !== null
                                  ? `${record.avg_days.toFixed(1)}g (${record.count})`
                                  : record
                                    ? `— (${record.count})`
                                    : '—'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-emerald-700 font-semibold">
                            {row.avg_days !== null ? `${row.avg_days.toFixed(1)}g` : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.total_orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400">Nessun dato sui tempi di consegna</div>
              )}
            </div>
          </>
        )}

        {activeSection === 'tempi' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Lead time buste per lavorazione</h3>
              </div>
              {data.busta_lead_times?.start_date && (
                <span className="text-xs text-slate-500">
                  Da {data.busta_lead_times.start_date} (data apertura)
                </span>
              )}
            </div>
            {leadTimeRows.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={leadTimeRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)} giorni`} />
                  <Bar dataKey="avg_days" name="Giorni medi" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400">Nessun dato sui tempi buste</div>
            )}
          </div>
        )}

        {activeSection === 'pagamenti' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Modalità di pagamento</h3>
                </div>
                {paymentTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={paymentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                        {paymentTypeData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400">Nessun dato sui pagamenti</div>
                )}
                {paymentTypeUnknown > 0 && (
                  <div className="text-xs text-slate-500 mt-2">
                    {paymentTypeUnknown} buste non classificate
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Euro className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Acconti registrati</h3>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                  <div>
                    <div className="text-sm text-slate-500">Buste con acconto</div>
                    <div className="text-3xl font-bold text-slate-900">{data.acconti?.with_acconto ?? 0}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Percentuale</div>
                    <div className="text-2xl font-semibold text-emerald-600">
                      {(data.acconti?.percent ?? 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400">su {data.acconti?.total ?? 0} buste</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Fatturato per Tipo</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Quantità</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Totale</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Media</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{item.tipo}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.count}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">€{item.revenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">€{item.avg.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeSection === 'ambassador' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ambassador totali */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Ambassador Totali</h3>
                </div>
                <div className="text-center py-4">
                  <div className="text-5xl font-bold text-purple-600">{data.ambassador?.totale ?? 0}</div>
                  <div className="text-sm text-slate-500 mt-2">clienti ambassador attivi</div>
                </div>
              </div>

              {/* Fonti Ambassador */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <Tag className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Fonti Ambassador</h3>
                </div>
                {data.ambassador?.by_fonte && Object.keys(data.ambassador.by_fonte).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.ambassador.by_fonte).map(([fonte, stats]) => {
                      const fonteLabels: Record<string, string> = {
                        survey: 'Survey',
                        follow_up: 'Follow-Up',
                        manuale: 'Manuale'
                      }
                      const fonteColors: Record<string, string> = {
                        survey: 'from-blue-500 to-cyan-500',
                        follow_up: 'from-purple-500 to-pink-500',
                        manuale: 'from-amber-500 to-orange-500'
                      }
                      return (
                        <div key={fonte}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{fonteLabels[fonte] || fonte}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-slate-900">{stats.totale}</span>
                              {stats.ultimi_30gg > 0 && (
                                <span className="ml-2 text-xs text-green-600">+{stats.ultimi_30gg} (30gg)</span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className={`bg-gradient-to-r ${fonteColors[fonte] || 'from-slate-400 to-slate-500'} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${Math.min(100, ((stats.totale / Math.max(data.ambassador?.totale || 1, 1)) * 100))}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-slate-400">Nessun ambassador ancora</div>
                )}
              </div>

              {/* Recensioni Google */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="bg-yellow-100 p-2 rounded-lg">
                    <Activity className="w-5 h-5 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Recensioni Google</h3>
                </div>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between bg-yellow-50 rounded-xl p-4">
                    <div>
                      <div className="text-sm text-slate-500">Recensioni richieste</div>
                      <div className="text-3xl font-bold text-slate-900">{data.ambassador?.recensioni_richieste ?? 0}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-500">Link inviati</div>
                      <div className="text-2xl font-semibold text-green-600">{data.ambassador?.link_inviati ?? 0}</div>
                    </div>
                  </div>
                  {(data.ambassador?.recensioni_richieste ?? 0) > 0 && (
                    <div className="text-center text-sm text-slate-500">
                      Tasso invio link: <span className="font-semibold text-slate-700">
                        {((data.ambassador?.link_inviati ?? 0) / (data.ambassador?.recensioni_richieste ?? 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
