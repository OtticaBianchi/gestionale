import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(rootDir, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const PRODUCT_SCORE_MAP = {
  'si': 100,
  'sì': 100,
  'abbastanza': 60,
  'non saprei': 50,
  'no': 0
}

const FOUR_STAR_EXPERIENCE_MAP = {
  1: 0,
  2: 30,
  3: 65,
  4: 100
}

const THREE_STAR_RECOMMEND_MAP = {
  1: 0,
  2: 50,
  3: 100
}

const SECTION_ORDER = ['controllo_vista', 'adattamento', 'prodotto', 'servizio', 'esperienza', 'passaparola']

function parseArgs(argv) {
  const args = {
    apply: false,
    limit: null
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--apply') {
      args.apply = true
      continue
    }
    if (token === '--limit') {
      const value = Number.parseInt(argv[i + 1] || '', 10)
      args.limit = Number.isFinite(value) && value > 0 ? value : null
      i += 1
      continue
    }
  }

  return args
}

function normalizeText(input) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLooseText(input) {
  return (input || '').toString().trim().toLowerCase()
}

function isNumericLikert(input) {
  return typeof input === 'string' && /^[1-5]$/.test(input.trim())
}

function detectSectionKey(header, hasAdattamentoQuestion) {
  const lower = normalizeText(header)

  if (lower.includes('controllo della vista')) return { key: 'controllo_vista', overallQuestion: false }
  if (lower.startsWith('il prodotto acquistato')) return { key: 'prodotto', overallQuestion: false }
  if (lower.startsWith('consiglieresti')) return { key: 'passaparola', overallQuestion: false }
  if (lower.startsWith('che giudizio daresti')) return { key: 'esperienza', overallQuestion: true }
  if (lower.includes('come valuti il servizio ricevuto')) return { key: 'servizio', overallQuestion: false }
  if (lower.includes('adattamento')) return { key: 'adattamento', overallQuestion: false }
  if (lower.includes('come e stata la tua esperienza')) {
    return { key: hasAdattamentoQuestion ? 'adattamento' : 'esperienza', overallQuestion: false }
  }

  return { key: 'other', overallQuestion: false }
}

function normalizeQuestionScore({ numericValue, sectionKey, overallQuestion }) {
  if (!Number.isFinite(numericValue)) return null

  if (sectionKey === 'passaparola') {
    return THREE_STAR_RECOMMEND_MAP[numericValue] ?? null
  }

  if (sectionKey === 'esperienza' && overallQuestion) {
    return FOUR_STAR_EXPERIENCE_MAP[numericValue] ?? null
  }

  // Default 5-star scale: 1->0, 5->100
  return ((numericValue - 1) / 4) * 100
}

function orderedSectionScores(sectionScores) {
  const safe = sectionScores && typeof sectionScores === 'object' ? sectionScores : {}
  const out = {}

  for (const key of SECTION_ORDER) {
    const value = safe[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Number(value.toFixed(2))
    }
  }

  const extras = Object.keys(safe)
    .filter((key) => !SECTION_ORDER.includes(key))
    .sort((a, b) => a.localeCompare(b))

  for (const key of extras) {
    const value = safe[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Number(value.toFixed(2))
    }
  }

  return out
}

function scoreResponseFromRawPayload(rawPayload, isHistorical) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {}
  const entries = Object.entries(payload)

  const hasAdattamentoQuestion = entries.some(([header, value]) => {
    if (!isNumericLikert(value)) return false
    return normalizeText(header).includes('adattamento')
  })

  const sectionBuckets = new Map()

  for (const [header, rawValue] of entries) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!value) continue
    if (!isNumericLikert(value)) continue

    const numericValue = Number(value)
    const { key, overallQuestion } = detectSectionKey(header, hasAdattamentoQuestion)
    if (key === 'other') continue

    const normalized = normalizeQuestionScore({
      numericValue,
      sectionKey: key,
      overallQuestion
    })
    if (!Number.isFinite(normalized)) continue

    if (!sectionBuckets.has(key)) sectionBuckets.set(key, [])
    sectionBuckets.get(key).push(normalized)
  }

  for (const [header, rawValue] of entries) {
    const lower = normalizeText(header)
    if (!lower.startsWith('il prodotto acquistato')) continue
    const answer = normalizeLooseText(rawValue)
    if (!answer) continue
    const mapped = PRODUCT_SCORE_MAP[answer]
    if (typeof mapped !== 'number') continue
    if (!sectionBuckets.has('prodotto')) sectionBuckets.set('prodotto', [])
    sectionBuckets.get('prodotto').push(mapped)
    break
  }

  const sectionScores = {}
  for (const [sectionKey, values] of sectionBuckets.entries()) {
    if (!values.length) continue
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    sectionScores[sectionKey] = Number(avg.toFixed(2))
  }

  const orderedScores = orderedSectionScores(sectionScores)
  const sectionValues = Object.values(orderedScores)
  const overallScore = sectionValues.length > 0
    ? Number((sectionValues.reduce((sum, value) => sum + value, 0) / sectionValues.length).toFixed(2))
    : null

  let lowSignalCount = 0
  let veryLowSignalCount = 0
  for (const value of sectionValues) {
    if (value <= 50) lowSignalCount += 1
    if (value <= 25) veryLowSignalCount += 1
  }

  const minSection = sectionValues.length > 0 ? Math.min(...sectionValues) : 100
  let badgeLevel = 'attenzione'
  if (overallScore !== null) {
    if (overallScore >= 90 && veryLowSignalCount === 0 && minSection >= 75) {
      badgeLevel = 'eccellente'
    } else if (overallScore >= 80 && veryLowSignalCount === 0 && minSection >= 60) {
      badgeLevel = 'positivo'
    } else if (overallScore < 70 || veryLowSignalCount > 0) {
      badgeLevel = 'critico'
    } else {
      badgeLevel = 'attenzione'
    }
  }

  const isRecent = !isHistorical
  const requiresFollowup = isRecent && (badgeLevel === 'attenzione' || badgeLevel === 'critico')
  const followupStatus = requiresFollowup
    ? 'pending'
    : ((badgeLevel === 'attenzione' || badgeLevel === 'critico') ? 'ignored_old' : 'none')

  return {
    overall_score: overallScore,
    badge_level: badgeLevel,
    section_scores: orderedScores,
    low_signal_count: lowSignalCount,
    very_low_signal_count: veryLowSignalCount,
    is_recent: isRecent,
    requires_followup: requiresFollowup,
    followup_status: followupStatus
  }
}

function sameJsonObject(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {})
}

function hasDiff(existing, next) {
  if ((existing.overall_score ?? null) !== (next.overall_score ?? null)) return true
  if ((existing.badge_level ?? null) !== (next.badge_level ?? null)) return true
  if (!sameJsonObject(existing.section_scores, next.section_scores)) return true
  if ((existing.low_signal_count ?? 0) !== (next.low_signal_count ?? 0)) return true
  if ((existing.very_low_signal_count ?? 0) !== (next.very_low_signal_count ?? 0)) return true
  if (Boolean(existing.is_recent) !== Boolean(next.is_recent)) return true
  if (Boolean(existing.requires_followup) !== Boolean(next.requires_followup)) return true
  if ((existing.followup_status ?? null) !== (next.followup_status ?? null)) return true
  return false
}

async function loadHistoricalBatchMap(batchIds) {
  const unique = [...new Set(batchIds.filter(Boolean))]
  const out = new Map()
  if (!unique.length) return out

  const chunkSize = 200
  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('survey_import_batches')
      .select('id, is_historical')
      .in('id', chunk)

    if (error) throw error
    for (const row of data || []) {
      out.set(row.id, Boolean(row.is_historical))
    }
  }

  return out
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const mode = args.apply ? 'APPLY' : 'DRY-RUN'

  console.log(`--- Survey Recalculate (${mode}) ---`)

  let from = 0
  const pageSize = 500
  let scanned = 0
  let changed = 0
  let updated = 0
  let skippedNoPayload = 0
  let failed = 0

  while (true) {
    const to = from + pageSize - 1
    const { data: rows, error } = await supabase
      .from('survey_responses')
      .select('id, batch_id, raw_payload, overall_score, badge_level, section_scores, low_signal_count, very_low_signal_count, is_recent, requires_followup, followup_status')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw error
    const chunk = rows || []
    if (!chunk.length) break

    const batchIds = chunk.map((row) => row.batch_id).filter(Boolean)
    const batchHistoricalMap = await loadHistoricalBatchMap(batchIds)

    for (const row of chunk) {
      scanned += 1
      if (args.limit && scanned > args.limit) break

      if (!row.raw_payload || typeof row.raw_payload !== 'object') {
        skippedNoPayload += 1
        continue
      }

      const isHistorical = batchHistoricalMap.has(row.batch_id) ? batchHistoricalMap.get(row.batch_id) : true
      const recalculated = scoreResponseFromRawPayload(row.raw_payload, Boolean(isHistorical))

      if (!hasDiff(row, recalculated)) continue
      changed += 1

      if (!args.apply) continue

      const { error: updateError } = await supabase
        .from('survey_responses')
        .update(recalculated)
        .eq('id', row.id)

      if (updateError) {
        failed += 1
        console.error(`Update failed for ${row.id}: ${updateError.message}`)
        continue
      }

      updated += 1
    }

    if (args.limit && scanned >= args.limit) break
    if (chunk.length < pageSize) break
    from += pageSize
  }

  console.log(`Scanned: ${scanned}`)
  console.log(`Changed: ${changed}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (no payload): ${skippedNoPayload}`)
  console.log(`Failed updates: ${failed}`)
}

run().catch((error) => {
  console.error('Survey recalculation failed:', error)
  process.exit(1)
})
