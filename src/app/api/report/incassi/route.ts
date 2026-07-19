export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  getPaymentCompletedAt,
  resolvePaymentPlanType,
  type PaymentPlan,
  type InfoPagamenti
} from '@/lib/buste/archiveRules'
import { resolveSaldoUnicoMethod } from '@/lib/payments/saldoMethod'

export type IncassoCategoria =
  | 'bonifico'
  | 'paghero'
  | 'contanti'
  | 'pos'
  | 'installments'
  | 'finanziamento_bancario'
  | 'altro'

export interface IncassoRow {
  busta_id: string
  readable_id: string
  cliente_nome: string
  tipo_lavorazione: string | null
  importo: number
  data_incasso: string
}

export interface IncassoCategoriaResult {
  label: string
  count: number
  totale: number
  buste: IncassoRow[]
}

const CATEGORIA_LABELS: Record<IncassoCategoria, string> = {
  bonifico: 'Bonifico',
  paghero: 'Pagherò',
  contanti: 'Contanti',
  pos: 'POS / Carta',
  installments: 'Rateizzato',
  finanziamento_bancario: 'Finanziamento bancario',
  altro: 'Altro / non classificato'
}

const CHUNK_SIZE = 300

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    if (!startDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(startDateParam) ||
        !endDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
      return NextResponse.json({ error: 'Intervallo date non valido (formato: YYYY-MM-DD)' }, { status: 400 })
    }

    const dateFrom = `${startDateParam}T00:00:00.000Z`
    const dateTo = `${endDateParam}T23:59:59.999Z`
    const fromMs = new Date(dateFrom).getTime()
    const toMs = new Date(dateTo).getTime()

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Candidati: righe toccate nell'intervallo su ciascuna delle 3 fonti.
    // updated_at è impostato allo stesso istante del completamento pagamento
    // in tutti i flussi di scrittura di /api/payments/actions.
    const [
      { data: planCandidates, error: planCandErr },
      { data: infoCandidates, error: infoCandErr },
      { data: installmentCandidates, error: instCandErr }
    ] = await Promise.all([
      admin.from('payment_plans')
        .select('busta_id')
        .gte('updated_at', dateFrom)
        .lte('updated_at', dateTo),
      admin.from('info_pagamenti')
        .select('busta_id')
        .not('prezzo_finale', 'is', null)
        .gte('updated_at', dateFrom)
        .lte('updated_at', dateTo),
      admin.from('payment_installments')
        .select('payment_plan_id')
        .eq('is_completed', true)
        .gte('updated_at', dateFrom)
        .lte('updated_at', dateTo)
    ])

    if (planCandErr || infoCandErr || instCandErr) {
      console.error('Report incassi: errore lettura candidati', { planCandErr, infoCandErr, instCandErr })
      return NextResponse.json({ error: 'Errore nel caricamento dei dati' }, { status: 500 })
    }

    const candidateBustaIds = new Set<string>()
    ;(planCandidates || []).forEach(r => candidateBustaIds.add(r.busta_id))
    ;(infoCandidates || []).forEach(r => candidateBustaIds.add(r.busta_id))

    // Le rate toccate nell'intervallo puntano a un payment_plan_id: serve
    // risalire al busta_id corrispondente.
    const installmentPlanIds = [...new Set((installmentCandidates || []).map(r => r.payment_plan_id).filter(Boolean))]
    for (const idsChunk of chunk(installmentPlanIds, CHUNK_SIZE)) {
      const { data: plansForInstallments, error } = await admin
        .from('payment_plans')
        .select('id, busta_id')
        .in('id', idsChunk)
      if (error) {
        console.error('Report incassi: errore risoluzione payment_plan_id -> busta_id', error)
        continue
      }
      ;(plansForInstallments || []).forEach(r => candidateBustaIds.add(r.busta_id))
    }

    const bustaIdList = [...candidateBustaIds]

    if (bustaIdList.length === 0) {
      return NextResponse.json({
        start_date: startDateParam,
        end_date: endDateParam,
        categorie: [],
        totale_count: 0,
        totale_importo: 0
      })
    }

    // 2. Per ogni busta candidata, recupera i dati COMPLETI (piano + tutte le
    // rate + info_pagamenti) necessari a calcolare la data di incasso reale
    // con la stessa logica già usata per l'archiviazione automatica in Kanban.
    const planByBusta = new Map<string, PaymentPlan & { busta_id: string }>()
    const infoByBusta = new Map<string, InfoPagamenti>()
    const bustaMeta = new Map<string, { readable_id: string; cliente_nome: string; tipo_lavorazione: string | null }>()

    for (const idsChunk of chunk(bustaIdList, CHUNK_SIZE)) {
      const [{ data: plans, error: plansErr }, { data: infos, error: infosErr }, { data: buste, error: busteErr }] = await Promise.all([
        admin.from('payment_plans')
          .select('busta_id, total_amount, acconto, payment_type, is_completed, created_at, updated_at, payment_installments(paid_amount, is_completed, updated_at)')
          .in('busta_id', idsChunk),
        admin.from('info_pagamenti')
          .select('busta_id, prezzo_finale, importo_acconto, is_saldato, modalita_saldo, note_pagamento, data_saldo, updated_at')
          .in('busta_id', idsChunk),
        admin.from('buste')
          .select('id, readable_id, tipo_lavorazione, clienti:cliente_id(nome, cognome)')
          .in('id', idsChunk)
      ])

      if (plansErr || infosErr || busteErr) {
        console.error('Report incassi: errore lettura dettagli', { plansErr, infosErr, busteErr })
        continue
      }

      ;(plans || []).forEach((p: any) => planByBusta.set(p.busta_id, p))
      ;(infos || []).forEach((i: any) => infoByBusta.set(i.busta_id, i))
      ;(buste || []).forEach((b: any) => {
        const cliente = Array.isArray(b.clienti) ? b.clienti[0] : b.clienti
        const cliente_nome = cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : '—'
        bustaMeta.set(b.id, {
          readable_id: b.readable_id,
          cliente_nome,
          tipo_lavorazione: b.tipo_lavorazione || null
        })
      })
    }

    // 3. Calcola la data di incasso reale per ciascuna busta candidata e
    // tiene solo quelle il cui incasso ricade davvero nell'intervallo
    // richiesto (i candidati sono presi con margine dal passo 1).
    const categorie: Record<IncassoCategoria, IncassoCategoriaResult> = {
      bonifico: { label: CATEGORIA_LABELS.bonifico, count: 0, totale: 0, buste: [] },
      paghero: { label: CATEGORIA_LABELS.paghero, count: 0, totale: 0, buste: [] },
      contanti: { label: CATEGORIA_LABELS.contanti, count: 0, totale: 0, buste: [] },
      pos: { label: CATEGORIA_LABELS.pos, count: 0, totale: 0, buste: [] },
      installments: { label: CATEGORIA_LABELS.installments, count: 0, totale: 0, buste: [] },
      finanziamento_bancario: { label: CATEGORIA_LABELS.finanziamento_bancario, count: 0, totale: 0, buste: [] },
      altro: { label: CATEGORIA_LABELS.altro, count: 0, totale: 0, buste: [] }
    }

    let totaleCount = 0
    let totaleImporto = 0

    bustaIdList.forEach(bustaId => {
      const plan = planByBusta.get(bustaId) ?? null
      const info = infoByBusta.get(bustaId) ?? null
      const meta = bustaMeta.get(bustaId)
      if (!meta) return

      const completedAt = getPaymentCompletedAt({ payment_plan: plan, info_pagamenti: info })
      if (!completedAt) return
      const completedMs = completedAt.getTime()
      if (completedMs < fromMs || completedMs > toMs) return

      const planType = resolvePaymentPlanType({ payment_plan: plan, info_pagamenti: info })
      const importo = plan?.total_amount ?? info?.prezzo_finale ?? 0

      // Buste chiuse senza incasso reale (omaggi, garanzie, note NESSUN_INCASSO)
      // non sono un "incasso": non vanno nel report.
      if (planType === 'no_payment' || planType === 'none' || !importo) return

      let categoria: IncassoCategoria = 'altro'
      if (planType === 'installments') {
        categoria = 'installments'
      } else if (planType === 'finanziamento_bancario') {
        categoria = 'finanziamento_bancario'
      } else if (planType === 'saldo_unico') {
        const metodo = resolveSaldoUnicoMethod({
          modalitaSaldo: info?.modalita_saldo,
          notePagamento: info?.note_pagamento
        })
        if (metodo === 'bonifico') categoria = 'bonifico'
        else if (metodo === 'paghero') categoria = 'paghero'
        else if (metodo === 'pos') categoria = 'pos'
        else if (metodo === 'contanti') categoria = 'contanti'
        else categoria = 'altro'
      }

      const row: IncassoRow = {
        busta_id: bustaId,
        readable_id: meta.readable_id,
        cliente_nome: meta.cliente_nome,
        tipo_lavorazione: meta.tipo_lavorazione,
        importo,
        data_incasso: completedAt.toISOString()
      }

      categorie[categoria].count += 1
      categorie[categoria].totale += importo
      categorie[categoria].buste.push(row)

      totaleCount += 1
      totaleImporto += importo
    })

    Object.values(categorie).forEach(cat => {
      cat.buste.sort((a, b) => a.data_incasso.localeCompare(b.data_incasso))
    })

    return NextResponse.json({
      start_date: startDateParam,
      end_date: endDateParam,
      categorie: (Object.keys(categorie) as IncassoCategoria[])
        .map(key => ({ key, ...categorie[key] }))
        .filter(cat => cat.count > 0),
      totale_count: totaleCount,
      totale_importo: totaleImporto
    })
  } catch (err: any) {
    console.error('Report incassi unexpected error:', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
