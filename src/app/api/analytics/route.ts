// API Route: /api/analytics
// Business Intelligence Dashboard - Optimized Query Structure

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import { LENS_TREATMENTS } from '@/lib/constants/lens-types';

export async function GET(request: NextRequest) {
  try {
    // Check user authentication first
    const cookieStore = await cookies();
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    );

    const { data: { user } } = await userSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato',
      }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Accesso non autorizzato',
      }, { status: 403 });
    }

    // Use service role client to bypass RLS for analytics
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const leadStartDate = new Date('2026-01-02');
    const leadDateFilter = (date: string | null) => {
      if (!date) return false;
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return false;
      if (parsed < leadStartDate) return false;
      return dateFilterFn(date);
    };

    const diffDays = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
      return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    };

    const normalizeTipoLavorazione = (tipo?: string | null): string | null => {
      if (!tipo) return null;
      return tipo === 'TALAC' ? 'LAC' : tipo;
    };

    // Fetch all ordini_materiali with related data
    const deliveredStates = ['consegnato', 'accettato_con_riserva', 'rifiutato'] as const;
    const isDeliveredState = (value: string | null | undefined): value is typeof deliveredStates[number] =>
      Boolean(value) && deliveredStates.includes(value as typeof deliveredStates[number]);

    const { data: ordiniAll, error: ordiniError } = await supabase
      .from('ordini_materiali')
      .select(`
        id,
        stato,
        created_at,
        busta_id,
        data_ordine,
        data_consegna_effettiva,
        tipo_lenti_id,
        classificazione_lenti_id,
        trattamenti,
        tipi_lenti:tipo_lenti_id(nome),
        classificazione_lenti:classificazione_lenti_id(nome),
        fornitori_montature:fornitore_montature_id(nome),
        fornitori_sport:fornitore_sport_id(nome),
        fornitori_lenti:fornitore_lenti_id(nome),
        fornitori_lac:fornitore_lac_id(nome),
        buste:busta_id(tipo_lavorazione, cliente_id, deleted_at, data_apertura, archived_mode)
      `)
      .is('deleted_at', null)
      .in('stato', deliveredStates)
      .is('buste.deleted_at', null);

    if (ordiniError) throw ordiniError;

    const filteredOrdini = (ordiniAll || []).filter(o => {
      const archivedMode = (o.buste as any)?.archived_mode;
      if (archivedMode === 'ANNULLATA') return false;
      return dateFilterFn(o.created_at);
    });

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
      const tipo = normalizeTipoLavorazione((o.buste as any)?.tipo_lavorazione);
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
        const nome = (ordine.tipi_lenti as any)?.nome || 'Non specificato';
        tipoLentiStats[nome] = (tipoLentiStats[nome] || 0) + 1;
      }
    });

    // 2.3 CLASSIFICAZIONE LENTI STATISTICS
    const classificazioneLentiStats: Record<string, number> = {};
    filteredOrdini.forEach(ordine => {
      if (ordine.tipo_lenti_id) {
        const nome = (ordine.classificazione_lenti as any)?.nome || 'Non specificato';
        classificazioneLentiStats[nome] = (classificazioneLentiStats[nome] || 0) + 1;
      }
    });

    // 2.5 TRATTAMENTI STATISTICS
    const trattamentiStats: Record<string, number> = {};
    let ordersWithTrattamenti = 0;
    const NONE_TREATMENT = LENS_TREATMENTS.NESSUNO;
    filteredOrdini.forEach(ordine => {
      const trattamenti = ordine.trattamenti as string[] | null;
      if (trattamenti && Array.isArray(trattamenti) && trattamenti.length > 0) {
        const normalized = trattamenti.filter(Boolean);
        if (normalized.length === 0) return;

        const hasNone = normalized.includes(NONE_TREATMENT);
        const effective = hasNone
          ? normalized.filter(t => t !== NONE_TREATMENT)
          : normalized;

        if (hasNone && effective.length === 0) {
          trattamentiStats[NONE_TREATMENT] = (trattamentiStats[NONE_TREATMENT] || 0) + 1;
          return;
        }

        if (effective.length > 0) {
          ordersWithTrattamenti++;
          effective.forEach(t => {
            trattamentiStats[t] = (trattamentiStats[t] || 0) + 1;
          });
        }
      }
    });

    // 2.6 TRATTAMENTI BY TIPO LENTI (cross-analysis)
    const trattamentiByTipoLenti: Record<string, Record<string, number>> = {};
    filteredOrdini.forEach(ordine => {
      const tipoLente = (ordine.tipi_lenti as any)?.nome;
      const trattamenti = ordine.trattamenti as string[] | null;
      if (tipoLente && trattamenti && Array.isArray(trattamenti)) {
        if (!trattamentiByTipoLenti[tipoLente]) {
          trattamentiByTipoLenti[tipoLente] = {};
        }
        const normalized = trattamenti.filter(Boolean);
        const effective = normalized.includes(NONE_TREATMENT)
          ? normalized.filter(t => t !== NONE_TREATMENT)
          : normalized;

        if (effective.length === 0) return;

        effective.forEach(t => {
          trattamentiByTipoLenti[tipoLente][t] = (trattamentiByTipoLenti[tipoLente][t] || 0) + 1;
        });
      }
    });

    // 2.7 TEMPI MEDI CONSEGNA LENTI (fornitori_lenti + tipo lenti)
    const lensDeliveryBySupplier: Record<string, {
      totalDays: number;
      count: number;
      byTipo: Record<string, { totalDays: number; count: number }>;
    }> = {};
    const lensDeliveryTypes = new Set<string>();

    (ordiniAll || []).forEach(ordine => {
      if (!ordine.data_ordine || !ordine.data_consegna_effettiva) return;
      if (!isDeliveredState(ordine.stato)) return;
      if (!dateFilterFn(ordine.data_consegna_effettiva)) return;
      if ((ordine.buste as any)?.archived_mode === 'ANNULLATA') return;

      const supplier = (ordine.fornitori_lenti as any)?.nome;
      if (!supplier) return;

      const tipo = (ordine.tipi_lenti as any)?.nome || 'Non specificato';
      lensDeliveryTypes.add(tipo);

      const days = diffDays(ordine.data_ordine, ordine.data_consegna_effettiva);
      if (days === null || days < 0) return;

      if (!lensDeliveryBySupplier[supplier]) {
        lensDeliveryBySupplier[supplier] = { totalDays: 0, count: 0, byTipo: {} };
      }

      lensDeliveryBySupplier[supplier].totalDays += days;
      lensDeliveryBySupplier[supplier].count += 1;

      if (!lensDeliveryBySupplier[supplier].byTipo[tipo]) {
        lensDeliveryBySupplier[supplier].byTipo[tipo] = { totalDays: 0, count: 0 };
      }
      lensDeliveryBySupplier[supplier].byTipo[tipo].totalDays += days;
      lensDeliveryBySupplier[supplier].byTipo[tipo].count += 1;
    });

    const lensDeliveryTypeOrder = ['Stock', 'Rx', 'Special', 'Non specificato'];
    const lensDeliveryTypesSorted = Array.from(lensDeliveryTypes).sort((a, b) => {
      const idxA = lensDeliveryTypeOrder.indexOf(a);
      const idxB = lensDeliveryTypeOrder.indexOf(b);
      if (idxA !== -1 || idxB !== -1) {
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      }
      return a.localeCompare(b);
    });

    const lensDeliveryRows = Object.entries(lensDeliveryBySupplier)
      .map(([supplier, stats]) => ({
        supplier,
        total_orders: stats.count,
        avg_days: stats.count > 0 ? stats.totalDays / stats.count : null,
        by_tipo: Object.fromEntries(
          lensDeliveryTypesSorted.map(tipo => {
            const record = stats.byTipo[tipo];
            return [tipo, record ? {
              avg_days: record.count > 0 ? record.totalDays / record.count : null,
              count: record.count
            } : null];
          })
        )
      }))
      .sort((a, b) => (b.total_orders - a.total_orders) || a.supplier.localeCompare(b.supplier));

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

    // 4. GENDER STATISTICS
    const genderStats: Record<string, number> = {};
    bustaToTipoMap.forEach((_, bustaId) => {
      const ordine = filteredOrdini.find(o => o.busta_id === bustaId);
      if (ordine) {
        const clienteId = (ordine.buste as any)?.cliente_id;
        const genere = clienteGenereMap.get(clienteId) || 'Non specificato';
        genderStats[genere] = (genderStats[genere] || 0) + 1;
      }
    });

    // 5. WARRANTY REPLACEMENTS
    const warrantyReplacements = [...bustaToTipoMap.values()].filter(tipo => tipo === 'SG').length;

    // 6. MONTHLY TREND (last 12 months) - using all ordini not just filtered
    const { data: allOrdiniForTrend } = await supabase
      .from('ordini_materiali')
      .select('created_at, stato, buste:busta_id(tipo_lavorazione, deleted_at)')
      .is('deleted_at', null)
      .in('stato', deliveredStates)
      .is('buste.deleted_at', null);

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
        const tipo = normalizeTipoLavorazione((o.buste as any)?.tipo_lavorazione);
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

    // 7. REVENUE BY TIPO LAVORAZIONE
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
      const tipo = normalizeTipoLavorazione((p.buste as any)?.tipo_lavorazione) || 'Non specificato';
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

    // 8. LEAD TIME BUSTA PER TIPO LAVORAZIONE
    const { data: statusHistoryRows } = await supabase
      .from('status_history')
      .select('busta_id, data_ingresso, buste!inner(id, tipo_lavorazione, data_apertura, archived_mode, deleted_at)')
      .eq('stato', 'consegnato_pagato')
      .is('buste.deleted_at', null);

    const leadByBusta = new Map<string, { openDate: string; closeDate: string; tipo: string }>();
    (statusHistoryRows || []).forEach((row: any) => {
      const busta = row.buste;
      if (!busta || busta.archived_mode === 'ANNULLATA') return;
      const dataApertura = busta.data_apertura;
      if (!leadDateFilter(dataApertura)) return;
      const dataIngresso = row.data_ingresso;
      if (!dataIngresso) return;

      const existing = leadByBusta.get(row.busta_id);
      if (!existing || new Date(dataIngresso) < new Date(existing.closeDate)) {
        leadByBusta.set(row.busta_id, {
          openDate: dataApertura,
          closeDate: dataIngresso,
          tipo: normalizeTipoLavorazione(busta.tipo_lavorazione) || 'Non specificato'
        });
      }
    });

    const leadTimeByTipo: Record<string, { totalDays: number; count: number }> = {};
    leadByBusta.forEach((value) => {
      const days = diffDays(value.openDate, value.closeDate);
      if (days === null || days < 0) return;
      if (!leadTimeByTipo[value.tipo]) {
        leadTimeByTipo[value.tipo] = { totalDays: 0, count: 0 };
      }
      leadTimeByTipo[value.tipo].totalDays += days;
      leadTimeByTipo[value.tipo].count += 1;
    });

    const leadTimeRows = Object.entries(leadTimeByTipo)
      .map(([tipo, stats]) => ({
        tipo,
        avg_days: stats.count > 0 ? stats.totalDays / stats.count : null,
        count: stats.count
      }))
      .sort((a, b) => (b.count - a.count) || a.tipo.localeCompare(b.tipo));

    // 9. PAYMENT TYPE DISTRIBUTION + ACCONTO
    const { data: bustePayments } = await supabase
      .from('buste')
      .select('id, data_apertura, archived_mode, deleted_at, payment_plan:payment_plans(payment_type), info_pagamenti(importo_acconto, ha_acconto, modalita_saldo)')
      .is('deleted_at', null);

    const paymentTypeStats: Record<string, number> = {
      saldo_unico: 0,
      installments: 0,
      finanziamento_bancario: 0,
      non_classificato: 0
    };

    let busteConsiderate = 0;
    let busteConAcconto = 0;

    const normalizePaymentType = (planType?: string | null, modalita?: string | null) => {
      if (planType === 'saldo_unico') return 'saldo_unico';
      if (planType === 'installments') return 'installments';
      if (planType === 'finanziamento_bancario') return 'finanziamento_bancario';
      if (!planType) {
        if (modalita === 'saldo_unico') return 'saldo_unico';
        if (modalita === 'finanziamento') return 'finanziamento_bancario';
        if (modalita === 'due_rate' || modalita === 'tre_rate') return 'installments';
      }
      return 'non_classificato';
    };

    (bustePayments || []).forEach((busta: any) => {
      if (busta.archived_mode === 'ANNULLATA') return;
      if (!leadDateFilter(busta.data_apertura)) return;

      busteConsiderate += 1;
      const planType = busta.payment_plan?.payment_type ?? null;
      const modalitaSaldo = busta.info_pagamenti?.modalita_saldo ?? null;
      const normalized = normalizePaymentType(planType, modalitaSaldo);
      paymentTypeStats[normalized] = (paymentTypeStats[normalized] || 0) + 1;

      const acconto = busta.info_pagamenti?.importo_acconto ?? 0;
      const haAcconto = busta.info_pagamenti?.ha_acconto ?? false;
      if (haAcconto || acconto > 0) {
        busteConAcconto += 1;
      }
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
      classificazione_lenti: {
        stats: classificazioneLentiStats,
        total: Object.values(classificazioneLentiStats).reduce((a, b) => a + b, 0),
      },
      trattamenti: {
        stats: trattamentiStats,
        total: Object.values(trattamentiStats).reduce((a, b) => a + b, 0),
        orders_with_trattamenti: ordersWithTrattamenti,
        by_tipo_lenti: trattamentiByTipoLenti,
      },
      lens_delivery_times: {
        by_supplier: lensDeliveryRows,
        types: lensDeliveryTypesSorted,
      },
      brands: {
        all: brandStats,
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
      busta_lead_times: {
        start_date: '2026-01-02',
        total: leadTimeRows.reduce((sum, row) => sum + row.count, 0),
        by_tipo: leadTimeRows,
      },
      payment_types: {
        stats: paymentTypeStats,
        total: busteConsiderate,
      },
      acconti: {
        with_acconto: busteConAcconto,
        total: busteConsiderate,
        percent: busteConsiderate > 0 ? (busteConAcconto / busteConsiderate) * 100 : 0,
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
