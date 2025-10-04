// API Route: /api/analytics
// Business Intelligence Dashboard - Optimized Query Structure

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/database.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const period = searchParams.get('period') || 'month';

    const now = new Date();
    let dateFilterFn: (date: string | null) => boolean;

    if (period === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      dateFilterFn = (date) => date ? new Date(date) >= start && new Date(date) <= end : false;
    } else {
      dateFilterFn = () => true;
    }

    // Fetch all ordini_materiali with related data
    const { data: ordiniAll, error: ordiniError } = await supabase
      .from('ordini_materiali')
      .select(`
        id,
        created_at,
        busta_id,
        tipo_lenti_id,
        tipi_lenti:tipo_lenti_id(nome, tipo),
        fornitori_montature:fornitore_montature_id(nome),
        fornitori_sport:fornitore_sport_id(nome),
        fornitori_lenti:fornitore_lenti_id(nome),
        fornitori_lac:fornitore_lac_id(nome),
        buste:busta_id(tipo_lavorazione, cliente_id)
      `);

    if (ordiniError) throw ordiniError;

    const filteredOrdini = ordiniAll?.filter(o => dateFilterFn(o.created_at)) || [];

    // Get unique busta IDs and cliente IDs from filtered orders
    const bustaIds = [...new Set(filteredOrdini.map(o => o.busta_id))];
    const clienteIds = [...new Set(filteredOrdini.map(o => (o.buste as any)?.cliente_id).filter(Boolean))];

    // Fetch cliente data for gender
    const { data: clientiData } = await supabase
      .from('clienti')
      .select('id, genere')
      .in('id', clienteIds);

    const clienteGenereMap = new Map(clientiData?.map(c => [c.id, c.genere]) || []);

    // 1. TIPO LAVORAZIONE STATISTICS
    const bustaToTipoMap = new Map<string, string>();
    filteredOrdini.forEach(o => {
      const tipo = (o.buste as any)?.tipo_lavorazione;
      if (tipo && !bustaToTipoMap.has(o.busta_id)) {
        bustaToTipoMap.set(o.busta_id, tipo);
      }
    });

    const tipoLavorazioneStats: Record<string, number> = {};
    bustaToTipoMap.forEach(tipo => {
      tipoLavorazioneStats[tipo] = (tipoLavorazioneStats[tipo] || 0) + 1;
    });

    // 2. TIPO LENTI STATISTICS
    const tipoLentiStats: Record<string, number> = {};
    filteredOrdini.forEach(ordine => {
      if (ordine.tipo_lenti_id) {
        const tipo = (ordine.tipi_lenti as any)?.tipo || 'Non specificato';
        tipoLentiStats[tipo] = (tipoLentiStats[tipo] || 0) + 1;
      }
    });

    // 3. BRAND ANALYTICS
    const brandStats: Record<string, number> = {};
    filteredOrdini.forEach(ordine => {
      const fornitore =
        (ordine.fornitori_montature as any)?.nome ||
        (ordine.fornitori_sport as any)?.nome ||
        (ordine.fornitori_lenti as any)?.nome ||
        (ordine.fornitori_lac as any)?.nome;

      if (fornitore) {
        brandStats[fornitore] = (brandStats[fornitore] || 0) + 1;
      }
    });

    // 4. SUNGLASSES BY BRAND (OS/LS tipo + fornitore)
    const sunglassesByBrand: Record<string, number> = {};
    const occhialiSoleBustaIds = [...bustaToTipoMap.entries()]
      .filter(([_, tipo]) => tipo === 'OS' || tipo === 'LS')
      .map(([id]) => id);

    filteredOrdini.forEach(ordine => {
      if (occhialiSoleBustaIds.includes(ordine.busta_id)) {
        const fornitore =
          (ordine.fornitori_montature as any)?.nome ||
          (ordine.fornitori_sport as any)?.nome;

        if (fornitore) {
          sunglassesByBrand[fornitore] = (sunglassesByBrand[fornitore] || 0) + 1;
        }
      }
    });

    // 5. GENDER STATISTICS
    const genderStats: Record<string, number> = {};
    bustaToTipoMap.forEach((_, bustaId) => {
      const ordine = filteredOrdini.find(o => o.busta_id === bustaId);
      if (ordine) {
        const clienteId = (ordine.buste as any)?.cliente_id;
        const genere = clienteGenereMap.get(clienteId) || 'Non specificato';
        genderStats[genere] = (genderStats[genere] || 0) + 1;
      }
    });

    // 6. SUNGLASSES BY GENDER + BRAND
    const sunglassesByGenderBrand: Record<string, any[]> = {
      maschio: [],
      femmina: [],
    };

    occhialiSoleBustaIds.forEach(bustaId => {
      const ordine = filteredOrdini.find(o => o.busta_id === bustaId);
      if (!ordine) return;

      const clienteId = (ordine.buste as any)?.cliente_id;
      const genere = clienteGenereMap.get(clienteId);

      if (genere === 'maschio' || genere === 'femmina') {
        const fornitore =
          (ordine.fornitori_montature as any)?.nome ||
          (ordine.fornitori_sport as any)?.nome;

        if (fornitore) {
          const existing = sunglassesByGenderBrand[genere].find(item => item.brand === fornitore);
          if (existing) {
            existing.count += 1;
          } else {
            sunglassesByGenderBrand[genere].push({ brand: fornitore, count: 1 });
          }
        }
      }
    });

    // 7. WARRANTY REPLACEMENTS
    const warrantyReplacements = [...bustaToTipoMap.values()].filter(tipo => tipo === 'SG').length;

    // 8. MONTHLY TREND (last 12 months) - using all ordini not just filtered
    const { data: allOrdiniForTrend } = await supabase
      .from('ordini_materiali')
      .select('created_at, buste:busta_id(tipo_lavorazione)');

    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthData = allOrdiniForTrend?.filter(o => {
        if (!o.created_at) return false;
        const ordineDate = new Date(o.created_at);
        return ordineDate >= date && ordineDate < nextMonth;
      }) || [];

      const uniqueBustas = new Map<string, string>();
      monthData.forEach(o => {
        const tipo = (o.buste as any)?.tipo_lavorazione;
        if (tipo) uniqueBustas.set((o as any).busta_id, tipo);
      });

      const tipoCount: Record<string, number> = {};
      uniqueBustas.forEach(tipo => {
        tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
      });

      monthlyTrend.push({
        month: date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
        total: uniqueBustas.size,
        OCV: tipoCount['OCV'] || 0,
        OV: tipoCount['OV'] || 0,
        LAC: tipoCount['LAC'] || 0,
        OS: tipoCount['OS'] || 0,
      });
    }

    // 9. REVENUE BY TIPO LAVORAZIONE
    const { data: paymentsData } = await supabase
      .from('info_pagamenti')
      .select('prezzo_finale, importo_acconto, is_saldato, busta_id, buste:busta_id(tipo_lavorazione)')
      .not('prezzo_finale', 'is', null)
      .in('busta_id', bustaIds);

    const revenueByTipo: Record<string, { total: number; count: number; avg: number }> = {};
    let totalRevenue = 0;
    let totalAcconti = 0;
    let saldateCount = 0;

    paymentsData?.forEach(p => {
      const tipo = (p.buste as any)?.tipo_lavorazione || 'Non specificato';
      if (!revenueByTipo[tipo]) {
        revenueByTipo[tipo] = { total: 0, count: 0, avg: 0 };
      }
      revenueByTipo[tipo].total += p.prezzo_finale || 0;
      revenueByTipo[tipo].count += 1;
      revenueByTipo[tipo].avg = revenueByTipo[tipo].total / revenueByTipo[tipo].count;

      totalRevenue += p.prezzo_finale || 0;
      totalAcconti += p.importo_acconto || 0;
      if (p.is_saldato) saldateCount += 1;
    });

    // Response
    return NextResponse.json({
      success: true,
      period: {
        type: period,
        start_date: startDate,
        end_date: endDate,
      },
      tipo_lavorazione: {
        stats: tipoLavorazioneStats,
        total: bustaToTipoMap.size,
      },
      tipo_lenti: {
        stats: tipoLentiStats,
        total: Object.values(tipoLentiStats).reduce((a, b) => a + b, 0),
      },
      brands: {
        all: brandStats,
        sunglasses: sunglassesByBrand,
        by_gender_sunglasses: sunglassesByGenderBrand,
      },
      gender: {
        stats: genderStats,
      },
      warranty: {
        total: warrantyReplacements,
      },
      trends: {
        monthly: monthlyTrend,
      },
      revenue: {
        total: totalRevenue,
        acconti: totalAcconti,
        saldati: saldateCount,
        average: paymentsData && paymentsData.length > 0 ? totalRevenue / paymentsData.length : 0,
        by_tipo: revenueByTipo,
      },
    });

  } catch (error: any) {
    console.error('❌ Analytics API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
