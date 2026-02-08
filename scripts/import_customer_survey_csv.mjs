import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
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

const COVERED_AUTO_MERGE_TABLES = new Set([
  'buste',
  'error_tracking',
  'voice_notes',
  'survey_response_matches'
])

const TYPES_SCHEMA_PATH = path.join(rootDir, 'src', 'types', 'database.types.ts')
let clienteIdTablesPromise = null

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

function parseArgs(argv) {
  const args = {
    file: '',
    dryRun: false,
    isHistorical: true,
    recencyDays: 90,
    notes: '',
    autoMergeOrthographic: true
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--file') {
      args.file = argv[i + 1] || ''
      i += 1
      continue
    }
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (token === '--live') {
      args.isHistorical = false
      continue
    }
    if (token === '--historical') {
      args.isHistorical = true
      continue
    }
    if (token === '--recency-days') {
      const value = Number(argv[i + 1] || '90')
      args.recencyDays = Number.isFinite(value) && value > 0 ? Math.floor(value) : 90
      i += 1
      continue
    }
    if (token === '--notes') {
      args.notes = argv[i + 1] || ''
      i += 1
      continue
    }
    if (token === '--no-auto-merge') {
      args.autoMergeOrthographic = false
      continue
    }
  }

  return args
}

function parseCsv(csvText) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]
    const next = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((value) => value !== '')) {
        rows.push(row)
      }
      row = []
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((value) => value !== '')) {
    rows.push(row)
  }

  if (rows.length === 0) return { headers: [], records: [] }

  const headers = rows[0].map((h) => h.trim())
  const records = rows.slice(1).map((cells) => {
    const record = {}
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] || '').trim()
    })
    return record
  })

  return { headers, records }
}

function normalizeText(input) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeEmail(input) {
  return (input || '').trim().toLowerCase()
}

function tokenizeName(input) {
  return normalizeText(input)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
}

function fullNameTokenKey(nome, cognome) {
  return tokenizeName(`${nome || ''} ${cognome || ''}`)
    .sort()
    .join(' ')
}

function detectColumns(headers, records) {
  const lowerMap = headers.map((h) => ({ header: h, lower: h.toLowerCase() }))

  const nameHeader = lowerMap.find(({ lower }) => lower.includes('presentiamoci'))?.header || headers[0]
  const emailHeader = lowerMap.find(({ lower }) => lower.includes('email'))?.header || null
  const productHeader = lowerMap.find(({ lower }) => lower.startsWith('il prodotto acquistato'))?.header || null
  const overallHeader = lowerMap.find(({ lower }) => lower.startsWith('che giudizio daresti'))?.header || null
  const recommendHeader = lowerMap.find(({ lower }) => lower.startsWith('consiglieresti'))?.header || null
  const suggestionHeader = lowerMap.find(({ lower }) => lower.includes('suggerimenti'))?.header || null

  const numericColumns = []
  const numericMaxByColumn = {}
  const dateCandidates = []

  for (const header of headers) {
    const values = records.map((row) => (row[header] || '').trim()).filter(Boolean)
    if (values.length === 0) continue

    const numeric = values.every((value) => /^[1-5]$/.test(value))
    if (numeric) {
      numericColumns.push(header)
      numericMaxByColumn[header] = values.reduce((max, value) => Math.max(max, Number(value)), 1)
      continue
    }

    const lowerHeader = header.toLowerCase()
    if (/(data|date|submitted|inviato|timestamp)/i.test(lowerHeader)) {
      dateCandidates.push(header)
    }
  }

  let submittedAtHeader = null
  for (const candidate of dateCandidates) {
    const values = records.map((row) => (row[candidate] || '').trim()).filter(Boolean)
    if (values.length === 0) continue
    const validCount = values.filter((value) => parseDateValue(value)).length
    if (validCount / values.length >= 0.7) {
      submittedAtHeader = candidate
      break
    }
  }

  return {
    nameHeader,
    emailHeader,
    productHeader,
    overallHeader,
    recommendHeader,
    suggestionHeader,
    numericColumns,
    numericMaxByColumn,
    submittedAtHeader
  }
}

function parseDateValue(input) {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const isoDate = new Date(trimmed)
  if (!Number.isNaN(isoDate.getTime())) return isoDate

  const dayFirst = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (dayFirst) {
    const day = Number(dayFirst[1])
    const month = Number(dayFirst[2])
    let year = Number(dayFirst[3])
    if (year < 100) year += 2000
    const hour = Number(dayFirst[4] || 0)
    const minute = Number(dayFirst[5] || 0)
    const second = Number(dayFirst[6] || 0)
    const parsed = new Date(year, month - 1, day, hour, minute, second)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return null
}

function getSectionKey(header, columns, context = { hasAdattamentoQuestion: false }) {
  if (!header) return 'other'
  const lower = header.toLowerCase()
  if (header === columns.overallHeader) return 'esperienza'
  if (header === columns.recommendHeader) return 'passaparola'
  if (header === columns.productHeader) return 'prodotto'
  if (lower.includes('controllo della vista')) return 'controllo_vista'
  if (lower.includes('adattamento')) return 'adattamento'
  if (lower.includes('come è stata la tua esperienza') || lower.includes('come e stata la tua esperienza')) {
    return context.hasAdattamentoQuestion ? 'adattamento' : 'esperienza'
  }
  if (lower.includes('come valuti il servizio ricevuto')) return 'servizio'
  return 'other'
}

function normalizeSurveyScore({ numericValue, maxScale, sectionKey, isOverallQuestion }) {
  if (!Number.isFinite(numericValue)) return null

  if (sectionKey === 'passaparola' && maxScale === 3) {
    return THREE_STAR_RECOMMEND_MAP[numericValue] ?? null
  }

  if (sectionKey === 'esperienza' && (isOverallQuestion || maxScale === 4)) {
    return FOUR_STAR_EXPERIENCE_MAP[numericValue] ?? null
  }

  const denominator = Math.max(1, maxScale - 1)
  return ((numericValue - 1) / denominator) * 100
}

function scoreResponse(row, columns, args) {
  const sectionBuckets = new Map()
  const suggestionText = columns.suggestionHeader ? (row[columns.suggestionHeader] || '').trim() : ''
  const hasAdattamentoQuestion = columns.numericColumns.some((header) => {
    const lower = header.toLowerCase()
    if (!lower.includes('adattamento')) return false
    return (row[header] || '').trim() !== ''
  })

  for (const header of columns.numericColumns) {
    const value = (row[header] || '').trim()
    if (!value) continue
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) continue

    const sectionKey = getSectionKey(header, columns, { hasAdattamentoQuestion })
    if (sectionKey === 'other') continue
    const maxScale = Math.max(1, columns.numericMaxByColumn[header] || 5)
    const normalized = normalizeSurveyScore({
      numericValue,
      maxScale,
      sectionKey,
      isOverallQuestion: header === columns.overallHeader
    })
    if (!Number.isFinite(normalized)) continue

    if (!sectionBuckets.has(sectionKey)) sectionBuckets.set(sectionKey, [])
    sectionBuckets.get(sectionKey).push(normalized)
  }

  if (columns.productHeader) {
    const productValue = (row[columns.productHeader] || '').trim().toLowerCase()
    if (productValue) {
      const mapped = PRODUCT_SCORE_MAP[productValue]
      if (typeof mapped === 'number') {
        const sectionKey = getSectionKey(columns.productHeader, columns, { hasAdattamentoQuestion })
        if (!sectionBuckets.has(sectionKey)) sectionBuckets.set(sectionKey, [])
        sectionBuckets.get(sectionKey).push(mapped)
      }
    }
  }

  const sectionScores = {}
  for (const [sectionKey, values] of sectionBuckets.entries()) {
    if (values.length === 0) continue
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    sectionScores[sectionKey] = Number(avg.toFixed(2))
  }

  const sectionValues = Object.values(sectionScores)
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

  const submittedAt = columns.submittedAtHeader
    ? parseDateValue((row[columns.submittedAtHeader] || '').trim())
    : null

  // Live imports represent newly received survey responses: always eligible for follow-up logic.
  // Historical backfills stay excluded from auto follow-up generation.
  const isRecent = !args.isHistorical

  const requiresFollowup = isRecent && (badgeLevel === 'attenzione' || badgeLevel === 'critico')
  const followupStatus = requiresFollowup
    ? 'pending'
    : ((badgeLevel === 'attenzione' || badgeLevel === 'critico') ? 'ignored_old' : 'none')

  return {
    overallScore,
    sectionScores,
    suggestionText: suggestionText || null,
    badgeLevel,
    lowSignalCount,
    veryLowSignalCount,
    submittedAt,
    isRecent,
    requiresFollowup,
    followupStatus
  }
}

async function loadClients() {
  const clients = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('clienti')
      .select('id, nome, cognome, email, telefono, data_nascita, note_cliente, created_at, updated_at, deleted_at')
      .range(from, to)

    if (error) throw error
    const chunk = data || []
    clients.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }

  return clients.map((client) => {
    const nome = normalizeText(client.nome || '')
    const cognome = normalizeText(client.cognome || '')
    const fullForward = normalizeText(`${client.nome || ''} ${client.cognome || ''}`)
    const fullReverse = normalizeText(`${client.cognome || ''} ${client.nome || ''}`)
    const fullTokens = new Set(tokenizeName(`${client.nome || ''} ${client.cognome || ''}`))

    return {
      id: client.id,
      rawNome: client.nome || '',
      rawCognome: client.cognome || '',
      nome,
      cognome,
      fullForward,
      fullReverse,
      email: normalizeEmail(client.email || ''),
      telefono: client.telefono || null,
      data_nascita: client.data_nascita || null,
      note_cliente: client.note_cliente || null,
      created_at: client.created_at || null,
      updated_at: client.updated_at || null,
      deleted_at: client.deleted_at || null,
      tokens: fullTokens
    }
  })
}

function buildClientIndexes(clients) {
  const byEmail = new Map()
  const byName = new Map()
  const tokenIndex = new Map()

  for (const client of clients) {
    if (client.email) {
      const list = byEmail.get(client.email) || []
      list.push(client)
      byEmail.set(client.email, list)
    }

    const nameKeys = [client.fullForward, client.fullReverse].filter(Boolean)
    for (const key of nameKeys) {
      const list = byName.get(key) || []
      list.push(client)
      byName.set(key, list)
    }

    for (const token of client.tokens) {
      const list = tokenIndex.get(token) || []
      list.push(client)
      tokenIndex.set(token, list)
    }
  }

  return { byEmail, byName, tokenIndex }
}

function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1
  }
  const union = tokensA.size + tokensB.size - intersection
  if (union === 0) return 0
  return intersection / union
}

function normalizeOrthographic(value) {
  return normalizeText(value)
}

function normalizePhoneDigits(value) {
  return (value || '').replace(/[^\d]/g, '')
}

function normalizeLooseText(value) {
  return (value || '').trim().toLowerCase()
}

async function discoverClienteIdTablesFromTypes() {
  const fallback = [...COVERED_AUTO_MERGE_TABLES]

  try {
    const content = await fs.readFile(TYPES_SCHEMA_PATH, 'utf8')
    const lines = content.split(/\r?\n/)
    const tables = new Set()
    let section = ''

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]

      if (/^\s{4}Tables:\s*\{/.test(line)) {
        section = 'tables'
        continue
      }
      if (/^\s{4}(Views|Functions|Enums|CompositeTypes):\s*\{/.test(line)) {
        section = 'other'
        continue
      }
      if (section !== 'tables') continue
      if (!line.includes('cliente_id:')) continue

      for (let j = i; j >= 0; j -= 1) {
        const match = lines[j].match(/^\s{6}([a-zA-Z0-9_]+):\s*\{$/)
        if (match) {
          tables.add(match[1])
          break
        }
        if (/^\s{4}Tables:\s*\{/.test(lines[j])) break
      }
    }

    for (const tableName of COVERED_AUTO_MERGE_TABLES) {
      tables.add(tableName)
    }

    return tables.size > 0 ? [...tables] : fallback
  } catch (error) {
    console.warn('Unable to discover cliente_id tables from types file, fallback to covered list only.')
    return fallback
  }
}

async function getClienteIdTables() {
  if (!clienteIdTablesPromise) {
    clienteIdTablesPromise = discoverClienteIdTablesFromTypes()
  }
  return clienteIdTablesPromise
}

function isMissingTableError(error) {
  const message = `${error?.message || ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('does not exist') || message.includes('could not find the table')
}

async function getExternalReferenceBlockers(clientId, cache) {
  if (cache.has(clientId)) return cache.get(clientId)

  const tablesWithClienteId = await getClienteIdTables()
  const externalTables = tablesWithClienteId.filter((tableName) => !COVERED_AUTO_MERGE_TABLES.has(tableName))
  const blockers = []

  for (const tableName of externalTables) {
    const { count, error } = await supabase
      .from(tableName)
      .select('cliente_id', { count: 'exact', head: true })
      .eq('cliente_id', clientId)

    if (error) {
      if (isMissingTableError(error)) {
        continue
      }
      blockers.push({
        table: tableName,
        count: null,
        error: error.message
      })
      continue
    }

    const refs = count || 0
    if (refs > 0) {
      blockers.push({
        table: tableName,
        count: refs,
        error: null
      })
    }
  }

  cache.set(clientId, blockers)
  return blockers
}

function formatBlockersForNote(entries) {
  return entries
    .map((entry) => {
      if (entry.error) return `${entry.table}:error`
      return `${entry.table}:${entry.count || 0}`
    })
    .join(', ')
}

function hasAccentedVowel(value) {
  return /[àèéìòùÀÈÉÌÒÙ]/.test(value || '')
}

function convertApostropheVowelsToAccents(value) {
  if (!value) return value
  const accentMap = {
    a: 'à',
    e: 'è',
    i: 'ì',
    o: 'ò',
    u: 'ù',
    A: 'À',
    E: 'È',
    I: 'Ì',
    O: 'Ò',
    U: 'Ù'
  }
  return value.replace(/([aeiouAEIOU])[’'](?=[\s.,;:!?)]|$)/g, (_, vowel) => accentMap[vowel] || vowel)
}

async function getActiveBusteCount(clientId, cache) {
  if (cache.has(clientId)) return cache.get(clientId)

  const { count, error } = await supabase
    .from('buste')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clientId)
    .is('deleted_at', null)

  if (error) {
    throw new Error(`Failed to count buste for client ${clientId}: ${error.message}`)
  }

  const value = count || 0
  cache.set(clientId, value)
  return value
}

async function chooseWinnerClient(candidates, busteCountCache) {
  const scored = []
  for (const candidate of candidates) {
    const busteCount = await getActiveBusteCount(candidate.id, busteCountCache)
    scored.push({ candidate, busteCount })
  }

  scored.sort((a, b) => {
    if (b.busteCount !== a.busteCount) return b.busteCount - a.busteCount

    const aAccent = hasAccentedVowel(a.candidate.rawCognome)
    const bAccent = hasAccentedVowel(b.candidate.rawCognome)
    if (aAccent !== bAccent) return aAccent ? -1 : 1

    const aCreated = a.candidate.created_at ? new Date(a.candidate.created_at).getTime() : Number.MAX_SAFE_INTEGER
    const bCreated = b.candidate.created_at ? new Date(b.candidate.created_at).getTime() : Number.MAX_SAFE_INTEGER
    if (aCreated !== bCreated) return aCreated - bCreated

    return a.candidate.id.localeCompare(b.candidate.id)
  })

  return {
    winner: scored[0].candidate,
    winnerBusteCount: scored[0].busteCount,
    scored
  }
}

function areOrthographicVariants(candidates) {
  if (!candidates || candidates.length < 2) return false
  const active = candidates.filter((candidate) => !candidate.deleted_at)
  if (active.length < 2) return false

  const emailSet = new Set(active.map((candidate) => candidate.email).filter(Boolean))
  if (emailSet.size !== 1) return false

  const fullNameKeys = new Set(
    active
      .map((candidate) => fullNameTokenKey(candidate.rawNome, candidate.rawCognome))
      .filter(Boolean)
  )
  if (fullNameKeys.size !== 1) return false

  const phoneSet = new Set(
    active
      .map((candidate) => normalizePhoneDigits(candidate.telefono))
      .filter((value) => value.length > 0)
  )
  if (phoneSet.size > 1) return false

  const birthSet = new Set(
    active
      .map((candidate) => candidate.data_nascita)
      .filter(Boolean)
  )
  if (birthSet.size > 1) return false

  const notesSet = new Set(
    active
      .map((candidate) => normalizeLooseText(candidate.note_cliente))
      .filter((value) => value.length > 0)
  )
  if (notesSet.size > 1) return false

  return true
}

function pickPreferredSurname(candidates, fallbackSurname) {
  for (const candidate of candidates) {
    if (hasAccentedVowel(candidate.rawCognome)) {
      return candidate.rawCognome
    }
  }

  for (const candidate of candidates) {
    const converted = convertApostropheVowelsToAccents(candidate.rawCognome)
    if (converted !== candidate.rawCognome && hasAccentedVowel(converted)) {
      return converted
    }
  }

  const fallbackConverted = convertApostropheVowelsToAccents(fallbackSurname || '')
  return fallbackConverted || fallbackSurname || ''
}

async function mergeClientIntoWinner({
  winner,
  loser,
  preferredSurname,
  adminUserId,
  mergedInto,
  busteCountCache
}) {
  const now = new Date().toISOString()
  const winnerUpdate = {
    updated_at: now
  }
  if (adminUserId) winnerUpdate.updated_by = adminUserId

  if (preferredSurname && preferredSurname !== winner.rawCognome) {
    winnerUpdate.cognome = preferredSurname
  }

  if (!winner.telefono && loser.telefono) winnerUpdate.telefono = loser.telefono
  if (!winner.email && loser.email) winnerUpdate.email = loser.email
  if (!winner.data_nascita && loser.data_nascita) winnerUpdate.data_nascita = loser.data_nascita
  if (!winner.note_cliente && loser.note_cliente) winnerUpdate.note_cliente = loser.note_cliente

  if (Object.keys(winnerUpdate).length > 0) {
    const { error: updateWinnerError } = await supabase
      .from('clienti')
      .update(winnerUpdate)
      .eq('id', winner.id)

    if (updateWinnerError) {
      throw new Error(`Failed to update winner ${winner.id}: ${updateWinnerError.message}`)
    }
  }

  if (winnerUpdate.cognome) winner.rawCognome = winnerUpdate.cognome
  if (winnerUpdate.email) winner.email = normalizeEmail(winnerUpdate.email)
  if (winnerUpdate.telefono) winner.telefono = winnerUpdate.telefono
  if (winnerUpdate.data_nascita) winner.data_nascita = winnerUpdate.data_nascita
  if (winnerUpdate.note_cliente) winner.note_cliente = winnerUpdate.note_cliente
  winner.updated_at = now
  winner.nome = normalizeText(winner.rawNome || '')
  winner.cognome = normalizeText(winner.rawCognome || '')
  winner.fullForward = normalizeText(`${winner.rawNome || ''} ${winner.rawCognome || ''}`)
  winner.fullReverse = normalizeText(`${winner.rawCognome || ''} ${winner.rawNome || ''}`)
  winner.tokens = new Set(tokenizeName(`${winner.rawNome || ''} ${winner.rawCognome || ''}`))

  const busteUpdate = await supabase
    .from('buste')
    .update({ cliente_id: winner.id, updated_at: now, ...(adminUserId ? { updated_by: adminUserId } : {}) })
    .eq('cliente_id', loser.id)

  if (busteUpdate.error) {
    throw new Error(`Failed to reassign buste from ${loser.id} to ${winner.id}: ${busteUpdate.error.message}`)
  }

  const errorTrackingUpdate = await supabase
    .from('error_tracking')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (errorTrackingUpdate.error) {
    throw new Error(`Failed to reassign error_tracking from ${loser.id} to ${winner.id}: ${errorTrackingUpdate.error.message}`)
  }

  const voiceNotesUpdate = await supabase
    .from('voice_notes')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (voiceNotesUpdate.error) {
    throw new Error(`Failed to reassign voice_notes from ${loser.id} to ${winner.id}: ${voiceNotesUpdate.error.message}`)
  }

  const surveyMatchesUpdate = await supabase
    .from('survey_response_matches')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (surveyMatchesUpdate.error) {
    throw new Error(`Failed to reassign survey matches from ${loser.id} to ${winner.id}: ${surveyMatchesUpdate.error.message}`)
  }

  const loserSoftDelete = {
    deleted_at: now,
    updated_at: now
  }
  if (adminUserId) {
    loserSoftDelete.deleted_by = adminUserId
    loserSoftDelete.updated_by = adminUserId
  }

  const { error: deleteLoserError } = await supabase
    .from('clienti')
    .update(loserSoftDelete)
    .eq('id', loser.id)
    .is('deleted_at', null)

  if (deleteLoserError) {
    throw new Error(`Failed to soft-delete loser ${loser.id}: ${deleteLoserError.message}`)
  }

  mergedInto.set(loser.id, winner.id)
  loser.deleted_at = now

  const winnerCount = busteCountCache.get(winner.id) || 0
  const loserCount = busteCountCache.get(loser.id) || 0
  busteCountCache.set(winner.id, winnerCount + loserCount)
  busteCountCache.set(loser.id, 0)
}

function canonicalClientId(clientId, mergedInto) {
  let current = clientId
  const seen = new Set()
  while (mergedInto.has(current) && !seen.has(current)) {
    seen.add(current)
    current = mergedInto.get(current)
  }
  return current
}

async function findMatch({
  respondentName,
  respondentEmail,
  indexes,
  clientById,
  mergedInto,
  busteCountCache,
  externalReferenceCache,
  adminUserId,
  dryRun,
  autoMergeOrthographic
}) {
  const normalizedName = normalizeText(respondentName)
  const normalizedEmail = normalizeEmail(respondentEmail)

  const result = {
    clienteId: null,
    confidence: 'none',
    strategy: 'unmatched',
    similarityScore: null,
    candidateClientIds: [],
    needsReview: false,
    notes: ''
  }

  const exactEmailCandidatesRaw = normalizedEmail ? (indexes.byEmail.get(normalizedEmail) || []) : []
  const exactNameCandidatesRaw = normalizedName ? (indexes.byName.get(normalizedName) || []) : []

  const dedupeByCanonicalId = (candidates) => {
    const map = new Map()
    for (const candidate of candidates) {
      const canonicalId = canonicalClientId(candidate.id, mergedInto)
      const canonicalCandidate = canonicalId === candidate.id
        ? candidate
        : (clientById.get(canonicalId) || candidates.find((item) => item.id === canonicalId) || candidate)
      if (!map.has(canonicalId)) {
        map.set(canonicalId, canonicalCandidate)
      }
    }
    return [...map.values()].filter((candidate) => !candidate.deleted_at)
  }

  const exactEmailCandidates = dedupeByCanonicalId(exactEmailCandidatesRaw)
  const exactNameCandidates = dedupeByCanonicalId(exactNameCandidatesRaw)

  if (normalizedEmail && normalizedName) {
    const highCandidates = exactEmailCandidates.filter((client) => (
      client.fullForward === normalizedName || client.fullReverse === normalizedName
    ))

    if (highCandidates.length === 1) {
      result.clienteId = highCandidates[0].id
      result.confidence = 'high'
      result.strategy = 'email_and_name_exact'
      return result
    }

    if (highCandidates.length > 1) {
      if (areOrthographicVariants(highCandidates) && autoMergeOrthographic) {
        const { winner } = await chooseWinnerClient(highCandidates, busteCountCache)
        const losers = highCandidates.filter((candidate) => candidate.id !== winner.id)
        const blockedLosers = []

        for (const loser of losers) {
          const blockers = await getExternalReferenceBlockers(loser.id, externalReferenceCache)
          if (blockers.length > 0) {
            blockedLosers.push({
              loserId: loser.id,
              blockers
            })
          }
        }

        if (blockedLosers.length > 0) {
          result.clienteId = winner.id
          result.confidence = 'high'
          result.strategy = 'email_and_name_exact_orthographic_guardrail_review'
          result.candidateClientIds = highCandidates.map((client) => client.id)
          result.needsReview = true
          result.notes = `Orthographic duplicate detected, but auto-merge blocked by guardrail (${blockedLosers.map((entry) => `${entry.loserId}[${formatBlockersForNote(entry.blockers)}]`).join(' | ')}).`
          return result
        }

        if (!dryRun) {
          const preferredSurname = pickPreferredSurname(highCandidates, winner.rawCognome)
          for (const loser of losers) {
            await mergeClientIntoWinner({
              winner,
              loser,
              preferredSurname,
              adminUserId,
              mergedInto,
              busteCountCache
            })
          }
        }

        result.clienteId = winner.id
        result.confidence = 'high'
        result.strategy = dryRun
          ? 'email_and_name_exact_orthographic_preview'
          : 'email_and_name_exact_orthographic_merged'
        result.notes = dryRun
          ? `Orthographic duplicate eligible for auto-merge (${losers.length}). Dry-run preview only.`
          : `Orthographic duplicate merged (${losers.length}) and auto-associated.`
        result.needsReview = false
        return result
      }

      if (areOrthographicVariants(highCandidates) && !autoMergeOrthographic) {
        const { winner } = await chooseWinnerClient(highCandidates, busteCountCache)
        result.clienteId = winner.id
        result.confidence = 'high'
        result.strategy = 'email_and_name_exact_orthographic_review'
        result.candidateClientIds = highCandidates.map((client) => client.id)
        result.needsReview = true
        result.notes = 'Orthographic duplicate detected. Auto-merge disabled: manual review required.'
        return result
      }

      const { winner } = await chooseWinnerClient(highCandidates, busteCountCache)
      result.clienteId = winner.id
      result.confidence = 'high'
      result.strategy = 'email_and_name_exact_tiebreak'
      result.candidateClientIds = highCandidates.map((client) => client.id)
      result.needsReview = true
      result.notes = 'Multiple clients match exact email + exact name.'
      return result
    }
  }

  if (exactEmailCandidates.length === 1) {
    result.clienteId = exactEmailCandidates[0].id
    result.confidence = 'medium'
    result.strategy = 'email_exact'
    return result
  }

  if (exactEmailCandidates.length > 1) {
    result.confidence = 'medium'
    result.strategy = 'email_exact'
    result.candidateClientIds = exactEmailCandidates.map((client) => client.id)
    result.needsReview = true
    result.notes = 'Multiple clients match exact email.'
    return result
  }

  if (exactNameCandidates.length === 1) {
    result.clienteId = exactNameCandidates[0].id
    result.confidence = 'medium'
    result.strategy = 'name_exact'
    return result
  }

  if (exactNameCandidates.length > 1) {
    result.confidence = 'medium'
    result.strategy = 'name_exact'
    result.candidateClientIds = exactNameCandidates.map((client) => client.id)
    result.needsReview = true
    result.notes = 'Multiple clients match exact name.'
    return result
  }

  const responseTokens = new Set(tokenizeName(normalizedName))
  if (responseTokens.size === 0) {
    return result
  }

  const candidateMap = new Map()
  for (const token of responseTokens) {
    const tokenClients = indexes.tokenIndex.get(token) || []
    for (const client of tokenClients) {
      candidateMap.set(client.id, client)
    }
  }

  if (candidateMap.size === 0) {
    return result
  }

  const ranked = [...candidateMap.values()]
    .map((client) => ({
      client,
      score: jaccardSimilarity(responseTokens, client.tokens)
    }))
    .filter((entry) => entry.score >= 0.55)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) {
    return result
  }

  result.confidence = 'low'
  result.strategy = 'name_similarity'
  result.similarityScore = Number(ranked[0].score.toFixed(2))
  result.candidateClientIds = ranked.slice(0, 3).map((entry) => entry.client.id)
  result.needsReview = true
  result.notes = 'Fuzzy name similarity candidate. Manual review required.'
  return result
}

function chunkArray(values, chunkSize) {
  const chunks = []
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize))
  }
  return chunks
}

async function getAdminId() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    console.warn('Could not resolve admin profile id:', error.message)
    return null
  }

  return data && data.length > 0 ? data[0].id : null
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    console.error('Usage: node scripts/import_customer_survey_csv.mjs --file <path> [--dry-run] [--live|--historical]')
    process.exit(1)
  }

  const csvPath = path.isAbsolute(args.file) ? args.file : path.resolve(process.cwd(), args.file)
  const fileContent = await fs.readFile(csvPath, 'utf8')
  const { headers, records } = parseCsv(fileContent)

  if (headers.length === 0 || records.length === 0) {
    console.error('CSV appears empty or invalid.')
    process.exit(1)
  }

  const columns = detectColumns(headers, records)
  const clients = await loadClients()
  const indexes = buildClientIndexes(clients)
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const mergedInto = new Map()
  const busteCountCache = new Map()
  const externalReferenceCache = new Map()
  const adminUserId = await getAdminId()

  console.log(`Loaded ${records.length} survey rows and ${clients.length} clients.`)
  console.log(`Detected name column: ${columns.nameHeader}`)
  console.log(`Detected email column: ${columns.emailHeader || '(none)'}`)
  console.log(`Detected submitted_at column: ${columns.submittedAtHeader || '(none)'}`)

  const prepared = []
  const stats = {
    totalRows: records.length,
    parsedRows: 0,
    matchedHigh: 0,
    matchedMedium: 0,
    matchedLow: 0,
    unmatched: 0,
    needsReview: 0,
    followsPending: 0
  }

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index]
    const respondentName = columns.nameHeader ? (row[columns.nameHeader] || '').trim() : ''
    const respondentEmail = columns.emailHeader ? (row[columns.emailHeader] || '').trim() : ''

    if (!respondentName && !respondentEmail) {
      continue
    }

    const scored = scoreResponse(row, columns, args)
    const match = await findMatch({
      respondentName,
      respondentEmail,
      indexes,
      clientById,
      mergedInto,
      busteCountCache,
      externalReferenceCache,
      adminUserId,
      dryRun: args.dryRun,
      autoMergeOrthographic: args.autoMergeOrthographic
    })

    stats.parsedRows += 1
    if (match.confidence === 'high') stats.matchedHigh += 1
    if (match.confidence === 'medium') stats.matchedMedium += 1
    if (match.confidence === 'low') stats.matchedLow += 1
    if (match.confidence === 'none') stats.unmatched += 1
    if (match.needsReview) stats.needsReview += 1
    if (scored.followupStatus === 'pending') stats.followsPending += 1

    prepared.push({
      sourceRowNumber: index + 2,
      response: {
        source_row_number: index + 2,
        respondent_name: respondentName || null,
        respondent_email: respondentEmail || null,
        submitted_at: scored.submittedAt ? scored.submittedAt.toISOString() : null,
        overall_score: scored.overallScore,
        badge_level: scored.badgeLevel,
        section_scores: scored.sectionScores,
        raw_payload: row,
        low_signal_count: scored.lowSignalCount,
        very_low_signal_count: scored.veryLowSignalCount,
        is_recent: scored.isRecent,
        requires_followup: scored.requiresFollowup,
        followup_status: scored.followupStatus
      },
      match: {
        cliente_id: match.clienteId,
        match_confidence: match.confidence,
        match_strategy: match.strategy,
        similarity_score: match.similarityScore,
        candidate_client_ids: match.candidateClientIds,
        needs_review: match.needsReview,
        matched_manually: false,
        match_notes: match.notes || null
      }
    })
  }

  console.log('--- Import Summary ---')
  console.log(`Total rows: ${stats.totalRows}`)
  console.log(`Parsed rows: ${stats.parsedRows}`)
  console.log(`High matches: ${stats.matchedHigh}`)
  console.log(`Medium matches: ${stats.matchedMedium}`)
  console.log(`Low matches: ${stats.matchedLow}`)
  console.log(`Unmatched: ${stats.unmatched}`)
  console.log(`Needs review: ${stats.needsReview}`)
  console.log(`Follow-up pending (live imports): ${stats.followsPending}`)

  if (args.dryRun) {
    console.log('Dry-run completed. No data was written.')
    return
  }

  const importedBy = await getAdminId()
  const { data: batch, error: batchError } = await supabase
    .from('survey_import_batches')
    .insert({
      source_filename: path.basename(csvPath),
      imported_by: importedBy,
      is_historical: args.isHistorical,
      recency_days: args.recencyDays,
      total_rows: stats.totalRows,
      parsed_rows: stats.parsedRows,
      matched_high: stats.matchedHigh,
      matched_medium: stats.matchedMedium,
      matched_low: stats.matchedLow,
      unmatched: stats.unmatched,
      needs_review: stats.needsReview,
      dry_run: false,
      notes: args.notes || null
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    throw new Error(`Failed to create import batch: ${batchError?.message || 'unknown error'}`)
  }

  const responseIdByRow = new Map()
  const responseChunks = chunkArray(prepared, 200)
  for (const chunk of responseChunks) {
    const payload = chunk.map((item) => ({
      ...item.response,
      batch_id: batch.id
    }))

    const { data, error } = await supabase
      .from('survey_responses')
      .insert(payload)
      .select('id, source_row_number')

    if (error) {
      throw new Error(`Failed to insert survey responses: ${error.message}`)
    }

    for (const inserted of data || []) {
      responseIdByRow.set(inserted.source_row_number, inserted.id)
    }
  }

  const matchesToInsert = prepared
    .map((item) => {
      const surveyResponseId = responseIdByRow.get(item.sourceRowNumber)
      if (!surveyResponseId) return null
      return {
        ...item.match,
        survey_response_id: surveyResponseId
      }
    })
    .filter(Boolean)

  const matchChunks = chunkArray(matchesToInsert, 200)
  for (const chunk of matchChunks) {
    const { error } = await supabase
      .from('survey_response_matches')
      .insert(chunk)

    if (error) {
      throw new Error(`Failed to insert survey matches: ${error.message}`)
    }
  }

  console.log(`Import completed. Batch ID: ${batch.id}`)
}

run().catch((error) => {
  console.error('Survey import failed:', error)
  process.exit(1)
})
