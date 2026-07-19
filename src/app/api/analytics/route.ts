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
import { getPaymentCompletedAt, resolvePaymentPlanType } from '@/lib/buste/archiveRules';

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

    // ✅ Supabase/PostgREST ritorna al massimo 1000 righe per query se non si
    // specifica esplicitamente .range(). Diverse query di questa route
    // superano abbondantemente 1000 righe (ordini_materiali ~2500,
    // status_history ~2350, buste ~3000): senza paginazione le righe più
    // recenti (in fondo, per data) restano semplicemente non recuperate,
    // svuotando silenziosamente marche/modelli/tipo lavorazione/trend/
    // acconti per i periodi "Mese"/"Trimestre". Questo helper pagina
    // qualunque query fino ad esaurimento.
    const PAGE_SIZE = 1000;
    async function fetchAllRows<T>(
      buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
    ): Promise<T[]> {
      const allRows: T[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error('Analytics: errore paginazione query', error);
          break;
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allRows;
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const period = searchParams.get('period') || 'month';

    const now = new Date();
    let dateFilterFn: (date: string | null) => boolean;
    // Confini espliciti del periodo selezionato, usati anche dalla sezione
    // incassi (scope per data di pagamento, non per data ordine).
    let periodStart: Date | null = null;
    let periodEnd: Date = now;

    if (period === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart = firstDay;
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
      periodStart = firstDay;
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      periodStart = firstDay;
      dateFilterFn = (date) => date ? new Date(date) >= firstDay : false;
    } else if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      periodStart = start;
      periodEnd = end;
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

    const normalizeTextKey = (value: string): string =>
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const treatmentCanonicalMap = new Map(
      Object.values(LENS_TREATMENTS).map(treatment => [normalizeTextKey(treatment), treatment])
    );

    const treatmentAliasMap = new Map<string, string>([
      ['antiriflesso', LENS_TREATMENTS.ANTIR],
      ['antiriflesso premium', LENS_TREATMENTS.ANTIR_PREMIUM],
      ['anti luce blu', LENS_TREATMENTS.ANTI_LUCE_BLU],
      ['anti luceblu', LENS_TREATMENTS.ANTI_LUCE_BLU],
      ['antiappannante', LENS_TREATMENTS.ANTI_APPANNANTE],
    ]);

    const normalizeTreatment = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      const key = normalizeTextKey(trimmed);
      return treatmentCanonicalMap.get(key) || treatmentAliasMap.get(key) || trimmed;
    };

    // Fetch all ordini_materiali with related data
    const deliveredStates = ['consegnato', 'accettato_con_riserva', 'rifiutato'] as const;
    const isDeliveredState = (value: string | null | undefined): value is typeof deliveredStates[number] =>
      Boolean(value) && deliveredStates.includes(value as typeof deliveredStates[number]);

    const ordiniAll = await fetchAllRows((from, to) =>
      supabase
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
        .is('buste.deleted_at', null)
        .range(from, to)
    );

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
        const normalized = Array.from(
          new Set(
            trattamenti
              .map(trattamento => normalizeTreatment(trattamento))
              .filter((trattamento): trattamento is string => Boolean(trattamento))
          )
        );
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
        const normalized = Array.from(
          new Set(
            trattamenti
              .map(trattamento => normalizeTreatment(trattamento))
              .filter((trattamento): trattamento is string => Boolean(trattamento))
          )
        );
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

    // 6. MONTHLY TREND (last 12 months)
    // Conta le buste che sono REALMENTE arrivate a "consegnato_pagato" nel
    // mese (stesso evento usato dal Kanban/dall'archiviazione automatica),
    // non le buste che hanno avuto un ordine materiale consegnato — le due
    // cose sono diverse: un ordine (lenti, montatura) può arrivare dal
    // fornitore molto prima che la busta venga chiusa e pagata.
    const statusHistoryRows = await fetchAllRows((from, to) =>
      supabase
        .from('status_history')
        .select('busta_id, data_ingresso, buste!inner(id, tipo_lavorazione, data_apertura, archived_mode, deleted_at)')
        .eq('stato', 'consegnato_pagato')
        .is('buste.deleted_at', null)
        .range(from, to)
    );

    // Prima volta (più antica) in cui ciascuna busta è entrata in
    // consegnato_pagato — non filtrata per periodo: serve sia al trend
    // (sempre "ultimi 12 mesi") sia al lead time (sezione 8, che applica
    // il proprio filtro periodo più sotto).
    const bustaConsegnatoPagatoAt = new Map<string, { openDate: string; closeDate: string; tipo: string }>();
    (statusHistoryRows || []).forEach((row: any) => {
      const busta = row.buste;
      if (!busta || busta.archived_mode === 'ANNULLATA') return;
      const dataIngresso = row.data_ingresso;
      if (!dataIngresso) return;

      const existing = bustaConsegnatoPagatoAt.get(row.busta_id);
      if (!existing || new Date(dataIngresso) < new Date(existing.closeDate)) {
        bustaConsegnatoPagatoAt.set(row.busta_id, {
          openDate: busta.data_apertura,
          closeDate: dataIngresso,
          tipo: normalizeTipoLavorazione(busta.tipo_lavorazione) || 'Non specificato'
        });
      }
    });

    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const tipoCount: Record<string, number> = {};
      let total = 0;
      bustaConsegnatoPagatoAt.forEach(({ closeDate, tipo }) => {
        const chiusuraDate = new Date(closeDate);
        if (chiusuraDate < date || chiusuraDate >= nextMonth) return;
        total += 1;
        tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
      });

      monthlyTrend.push({
        month: date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
        total,
        OCV: tipoCount['OCV'] || 0,
        OV: tipoCount['OV'] || 0,
        LAC: tipoCount['LAC'] || 0,
        OS: tipoCount['OS'] || 0,
      });
    }

    // 7. REVENUE BY TIPO LAVORAZIONE
    // Scope: buste il cui INCASSO (data di completamento pagamento) ricade
    // nel periodo selezionato — non le buste con un ordine creato nel
    // periodo (bustaIds, sezione 6). Un ordine piazzato a giugno e incassato
    // a luglio è un incasso di luglio: filtrarlo per data ordine lo faceva
    // sparire dal periodo "Mese"/"Trimestre" (spesso a zero) e lo mostrava
    // solo scegliendo "Anno".
    //
    // Fonte dati: payment_plans (sistema attuale) con fallback a info_pagamenti
    // (sistema legacy) per le buste che non hanno ancora un payment_plan.
    //
    // ✅ Le query .in('busta_id', ids) vanno spezzate in lotti: con liste
    // ampie l'URL della richiesta GET supera il limite del server, con
    // errore silenzioso (data: null, error non controllato) che azzerava
    // gli incassi senza nessun avviso.
    const REVENUE_CHUNK_SIZE = 300;
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const revenueRangeStartIso = (periodStart ?? new Date('2020-01-01')).toISOString();
    const revenueRangeEndIso = periodEnd.toISOString();

    const [{ data: planCandidates }, { data: infoCandidates }, { data: installmentCandidates }] = await Promise.all([
      supabase.from('payment_plans').select('busta_id')
        .gte('updated_at', revenueRangeStartIso).lte('updated_at', revenueRangeEndIso),
      supabase.from('info_pagamenti').select('busta_id')
        .not('prezzo_finale', 'is', null)
        .gte('updated_at', revenueRangeStartIso).lte('updated_at', revenueRangeEndIso),
      supabase.from('payment_installments').select('payment_plan_id')
        .eq('is_completed', true)
        .gte('updated_at', revenueRangeStartIso).lte('updated_at', revenueRangeEndIso)
    ]);

    const revenueCandidateIds = new Set<string>();
    (planCandidates || []).forEach((r: any) => revenueCandidateIds.add(r.busta_id));
    (infoCandidates || []).forEach((r: any) => revenueCandidateIds.add(r.busta_id));

    const installmentPlanIds = [...new Set((installmentCandidates || []).map((r: any) => r.payment_plan_id).filter(Boolean))];
    for (const idsChunk of chunkArray(installmentPlanIds, REVENUE_CHUNK_SIZE)) {
      const { data: plansForInstallments } = await supabase
        .from('payment_plans').select('id, busta_id').in('id', idsChunk);
      (plansForInstallments || []).forEach((r: any) => revenueCandidateIds.add(r.busta_id));
    }

    const revenueBustaIdList = [...revenueCandidateIds];
    const planByBustaId = new Map<string, any>();
    const infoByBustaId = new Map<string, any>();

    for (const idsChunk of chunkArray(revenueBustaIdList, REVENUE_CHUNK_SIZE)) {
      const [{ data: planChunk, error: planChunkError }, { data: infoChunk, error: infoChunkError }] = await Promise.all([
        supabase.from('payment_plans')
          .select('busta_id, total_amount, acconto, payment_type, is_completed, created_at, updated_at, payment_installments(paid_amount, is_completed, updated_at), buste:busta_id(tipo_lavorazione)')
          .in('busta_id', idsChunk),
        supabase.from('info_pagamenti')
          .select('busta_id, prezzo_finale, importo_acconto, is_saldato, modalita_saldo, note_pagamento, data_saldo, updated_at, buste:busta_id(tipo_lavorazione)')
          .not('prezzo_finale', 'is', null)
          .in('busta_id', idsChunk)
      ]);
      if (planChunkError) console.error('Analytics revenue: errore lettura payment_plans (chunk)', planChunkError);
      if (infoChunkError) console.error('Analytics revenue: errore lettura info_pagamenti (chunk)', infoChunkError);
      (planChunk || []).forEach((p: any) => planByBustaId.set(p.busta_id, p));
      (infoChunk || []).forEach((i: any) => infoByBustaId.set(i.busta_id, i));
    }

    const revenueByTipo: Record<string, { total: number; count: number; avg: number }> = {};
    let totalRevenue = 0;
    let totalAcconti = 0;
    let saldateCount = 0;
    let revenueBustaCount = 0;
    const periodStartMs = periodStart ? periodStart.getTime() : Number.NEGATIVE_INFINITY;
    const periodEndMs = periodEnd.getTime();

    revenueBustaIdList.forEach(bustaId => {
      const plan = planByBustaId.get(bustaId) ?? null;
      const info = infoByBustaId.get(bustaId) ?? null;

      const completedAt = getPaymentCompletedAt({ payment_plan: plan, info_pagamenti: info });
      if (!completedAt) return;
      const completedMs = completedAt.getTime();
      if (completedMs < periodStartMs || completedMs > periodEndMs) return;

      const planType = resolvePaymentPlanType({ payment_plan: plan, info_pagamenti: info });
      const totalAmount = plan?.total_amount ?? info?.prezzo_finale ?? 0;
      // Buste chiuse senza incasso reale (omaggi, garanzie, NESSUN_INCASSO)
      // non sono un incasso: non contano nel fatturato.
      if (planType === 'no_payment' || planType === 'none' || !totalAmount) return;

      const acconto = plan?.acconto ?? info?.importo_acconto ?? 0;
      const isSaldato = plan ? plan.is_completed === true : info?.is_saldato === true;
      const tipoLavorazione = (plan?.buste as any)?.tipo_lavorazione ?? (info?.buste as any)?.tipo_lavorazione;
      const tipo = normalizeTipoLavorazione(tipoLavorazione) || 'Non specificato';

      if (!revenueByTipo[tipo]) {
        revenueByTipo[tipo] = { total: 0, count: 0, avg: 0 };
      }
      revenueByTipo[tipo].total += totalAmount;
      revenueByTipo[tipo].count += 1;
      revenueByTipo[tipo].avg = revenueByTipo[tipo].total / revenueByTipo[tipo].count;

      totalRevenue += totalAmount;
      totalAcconti += acconto;
      revenueBustaCount += 1;
      if (isSaldato) saldateCount += 1;
    });

    // 8. LEAD TIME BUSTA PER TIPO LAVORAZIONE
    // Riusa bustaConsegnatoPagatoAt (sezione 6), applicando qui il filtro
    // periodo specifico del lead time (leadDateFilter, con la propria data
    // di inizio dati '2026-01-02').
    const leadTimeByTipo: Record<string, { totalDays: number; count: number }> = {};
    bustaConsegnatoPagatoAt.forEach((value) => {
      if (!leadDateFilter(value.openDate)) return;
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
    const bustePayments = await fetchAllRows((from, to) =>
      supabase
        .from('buste')
        .select('id, data_apertura, archived_mode, deleted_at, payment_plan:payment_plans(payment_type), info_pagamenti(importo_acconto, ha_acconto, modalita_saldo)')
        .is('deleted_at', null)
        .range(from, to)
    );

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
        if (modalita === 'saldo_unico' || modalita === 'contanti' || modalita === 'pos' || modalita === 'bonifico' || modalita === 'paghero' || modalita === 'carta') {
          return 'saldo_unico';
        }
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

    // 10. AMBASSADOR & RECENSIONI STATS
    const { data: ambassadorStats } = await supabase
      .from('clienti')
      .select('id, is_ambassador, ambassador_code, ambassador_activated_at, fonte_ambassador')
      .eq('is_ambassador', true)

    const ambassadorByFonte: Record<string, { totale: number; ultimi_30gg: number }> = {}
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    ;(ambassadorStats || []).forEach((c: any) => {
      const fonte = c.fonte_ambassador || 'manuale'
      if (!ambassadorByFonte[fonte]) {
        ambassadorByFonte[fonte] = { totale: 0, ultimi_30gg: 0 }
      }
      ambassadorByFonte[fonte].totale += 1
      if (c.ambassador_activated_at && new Date(c.ambassador_activated_at) >= thirtyDaysAgo) {
        ambassadorByFonte[fonte].ultimi_30gg += 1
      }
    })

    const { data: recensioniStats } = await supabase
      .from('follow_up_chiamate')
      .select('id, richiesta_recensione_google, link_recensione_inviato')
      .eq('richiesta_recensione_google', true)

    const recensioniRichieste = recensioniStats?.length || 0
    const linkInviati = recensioniStats?.filter((r: any) => r.link_recensione_inviato).length || 0

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
        average: revenueBustaCount > 0 ? totalRevenue / revenueBustaCount : 0,
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
      ambassador: {
        totale: ambassadorStats?.length || 0,
        by_fonte: ambassadorByFonte,
        recensioni_richieste: recensioniRichieste,
        link_inviati: linkInviati,
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
