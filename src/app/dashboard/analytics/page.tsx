'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Activity, TrendingUp, Package, AlertCircle, Euro, Calendar, Tag, Eye, Users, ArrowUp, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
  tipo_lavorazione: { stats: Record<string, number>; total: number };
  tipo_lenti: { stats: Record<string, number>; total: number };
  brands: {
    all: Record<string, number>;
    sunglasses: Record<string, number>;
    by_gender_sunglasses: {
      maschio: Array<{ brand: string; count: number }>;
      femmina: Array<{ brand: string; count: number }>;
    };
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
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
  const topSunglassesBrands = Object.entries(data.brands.sunglasses).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  const maleSunglasses = data.brands.by_gender_sunglasses.maschio.sort((a, b) => b.count - a.count).slice(0, 6);
  const femaleSunglasses = data.brands.by_gender_sunglasses.femmina.sort((a, b) => b.count - a.count).slice(0, 6);
  const revenueData = Object.entries(data.revenue.by_tipo).map(([tipo, stats]) => ({ tipo, revenue: stats.total, count: stats.count, avg: stats.avg })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

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
              {topBrands.map((brand, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{brand.name}</span>
                      <span className="text-sm font-bold text-slate-900">{brand.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(brand.value / topBrands[0].value) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 mb-4">
              <Eye className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-slate-900">Occhiali da Sole</h3>
            </div>
            {topSunglassesBrands.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topSunglassesBrands} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {topSunglassesBrands.map((_, idx) => (<Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="flex items-center justify-center h-60 text-slate-400"><p>Nessun dato</p></div>)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Occhiali Sole - Uomo</h3>
            </div>
            {maleSunglasses.length > 0 ? (
              <div className="space-y-2">
                {maleSunglasses.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors">
                    <span className="text-sm font-medium text-slate-700">{item.brand}</span>
                    <span className="text-sm font-bold text-blue-600">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (<div className="flex items-center justify-center h-40 text-slate-400">Nessun dato</div>)}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-pink-600" />
              <h3 className="text-lg font-semibold text-slate-900">Occhiali Sole - Donna</h3>
            </div>
            {femaleSunglasses.length > 0 ? (
              <div className="space-y-2">
                {femaleSunglasses.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg hover:bg-pink-50 transition-colors">
                    <span className="text-sm font-medium text-slate-700">{item.brand}</span>
                    <span className="text-sm font-bold text-pink-600">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (<div className="flex items-center justify-center h-40 text-slate-400">Nessun dato</div>)}
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
      </div>
    </div>
  );
}
