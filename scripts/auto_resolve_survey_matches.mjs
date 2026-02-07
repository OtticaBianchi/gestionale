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

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    limit: Math.max(
      1,
      Number.parseInt(
        argv.find((token, idx) => token === '--limit' ? argv[idx + 1] : '') || '2000',
        10
      ) || 2000
    )
  }
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

function normalizePhoneDigits(input) {
  return (input || '').replace(/[^\d]/g, '')
}

function normalizeLooseText(input) {
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

function hasAccentedVowel(value) {
  return /[àèéìòùÀÈÉÌÒÙ]/.test(value || '')
}

function convertApostropheVowelsToAccents(value) {
  if (!value) return value || ''
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

function isIdentityEquivalentDuplicates(clients) {
  if (!clients || clients.length < 2) return false

  const emailSet = new Set(clients.map((client) => normalizeEmail(client.email)).filter(Boolean))
  if (emailSet.size !== 1) return false

  const fullNameKeys = new Set(
    clients
      .map((client) => fullNameTokenKey(client.nome, client.cognome))
      .filter(Boolean)
  )
  if (fullNameKeys.size !== 1) return false

  const phoneSet = new Set(
    clients
      .map((client) => normalizePhoneDigits(client.telefono))
      .filter((value) => value.length > 0)
  )
  if (phoneSet.size > 1) return false

  const birthSet = new Set(
    clients
      .map((client) => client.data_nascita)
      .filter(Boolean)
  )
  if (birthSet.size > 1) return false

  const notesSet = new Set(
    clients
      .map((client) => normalizeLooseText(client.note_cliente))
      .filter((value) => value.length > 0)
  )
  if (notesSet.size > 1) return false

  return true
}

async function getActiveBusteCount(clientId, cache) {
  if (cache.has(clientId)) return cache.get(clientId)

  const { count, error } = await supabase
    .from('buste')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clientId)
    .is('deleted_at', null)

  if (error) {
    throw new Error(`Failed to count buste for ${clientId}: ${error.message}`)
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

    const aAccent = hasAccentedVowel(a.candidate.cognome)
    const bAccent = hasAccentedVowel(b.candidate.cognome)
    if (aAccent !== bAccent) return aAccent ? -1 : 1

    const aCreated = a.candidate.created_at ? new Date(a.candidate.created_at).getTime() : Number.MAX_SAFE_INTEGER
    const bCreated = b.candidate.created_at ? new Date(b.candidate.created_at).getTime() : Number.MAX_SAFE_INTEGER
    if (aCreated !== bCreated) return aCreated - bCreated

    return a.candidate.id.localeCompare(b.candidate.id)
  })

  return scored[0].candidate
}

function pickPreferredSurname(candidates, fallbackSurname) {
  for (const candidate of candidates) {
    if (hasAccentedVowel(candidate.cognome)) return candidate.cognome || ''
  }

  for (const candidate of candidates) {
    const converted = convertApostropheVowelsToAccents(candidate.cognome)
    if (hasAccentedVowel(converted)) return converted
  }

  return convertApostropheVowelsToAccents(fallbackSurname || '') || fallbackSurname || ''
}

async function mergeClientIntoWinner({ winner, loser, preferredSurname, busteCountCache }) {
  const now = new Date().toISOString()
  const winnerUpdate = { updated_at: now }

  if (preferredSurname && preferredSurname !== winner.cognome) {
    winnerUpdate.cognome = preferredSurname
  }

  if (!winner.telefono && loser.telefono) winnerUpdate.telefono = loser.telefono
  if (!winner.email && loser.email) winnerUpdate.email = loser.email
  if (!winner.data_nascita && loser.data_nascita) winnerUpdate.data_nascita = loser.data_nascita
  if (!winner.note_cliente && loser.note_cliente) winnerUpdate.note_cliente = loser.note_cliente

  const { error: winnerUpdateError } = await supabase
    .from('clienti')
    .update(winnerUpdate)
    .eq('id', winner.id)

  if (winnerUpdateError) {
    throw new Error(`Failed to update winner ${winner.id}: ${winnerUpdateError.message}`)
  }

  const { error: busteUpdateError } = await supabase
    .from('buste')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (busteUpdateError) {
    throw new Error(`Failed to move buste from ${loser.id}: ${busteUpdateError.message}`)
  }

  const { error: errorsUpdateError } = await supabase
    .from('error_tracking')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (errorsUpdateError) {
    throw new Error(`Failed to move error_tracking from ${loser.id}: ${errorsUpdateError.message}`)
  }

  const { error: voiceUpdateError } = await supabase
    .from('voice_notes')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (voiceUpdateError) {
    throw new Error(`Failed to move voice_notes from ${loser.id}: ${voiceUpdateError.message}`)
  }

  const { error: surveyUpdateError } = await supabase
    .from('survey_response_matches')
    .update({ cliente_id: winner.id, updated_at: now })
    .eq('cliente_id', loser.id)

  if (surveyUpdateError) {
    throw new Error(`Failed to move survey_response_matches from ${loser.id}: ${surveyUpdateError.message}`)
  }

  const { error: deleteError } = await supabase
    .from('clienti')
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq('id', loser.id)
    .is('deleted_at', null)

  if (deleteError) {
    throw new Error(`Failed to soft-delete loser ${loser.id}: ${deleteError.message}`)
  }

  const winnerCount = busteCountCache.get(winner.id) || 0
  const loserCount = busteCountCache.get(loser.id) || 0
  busteCountCache.set(winner.id, winnerCount + loserCount)
  busteCountCache.set(loser.id, 0)
}

function appendNotes(base, extra) {
  const cleanBase = (base || '').trim()
  const cleanExtra = (extra || '').trim()
  if (!cleanBase) return cleanExtra
  if (!cleanExtra) return cleanBase
  return `${cleanBase}\n${cleanExtra}`
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = !args.apply
  const busteCountCache = new Map()

  const { data: rows, error } = await supabase
    .from('survey_match_review_queue')
    .select('match_id, respondent_name, respondent_email, match_confidence, match_strategy, candidate_client_ids, match_notes')
    .eq('needs_review', true)
    .order('response_created_at', { ascending: false })
    .limit(args.limit)

  if (error) throw new Error(`Failed to fetch survey_match_review_queue: ${error.message}`)

  const queue = rows || []
  const summary = {
    totalQueue: queue.length,
    resolved: 0,
    resolvedSingleActive: 0,
    resolvedUniqueByRespondent: 0,
    resolvedMerged: 0,
    rejectedNoActive: 0,
    skippedAmbiguous: 0
  }

  for (const row of queue) {
    const candidateIds = Array.from(new Set(
      (Array.isArray(row.candidate_client_ids) ? row.candidate_client_ids : [])
        .filter((id) => typeof id === 'string' && id.trim() !== '')
    ))

    if (candidateIds.length === 0) {
      summary.skippedAmbiguous += 1
      continue
    }

    const { data: clients, error: clientsError } = await supabase
      .from('clienti')
      .select('id, nome, cognome, email, telefono, data_nascita, note_cliente, created_at, deleted_at')
      .in('id', candidateIds)

    if (clientsError) throw new Error(`Failed to fetch candidates for match ${row.match_id}: ${clientsError.message}`)

    const activeClients = (clients || []).filter((client) => !client.deleted_at)
    let resolvedClienteId = null
    let resolutionStrategy = ''

    if (activeClients.length === 0) {
      resolutionStrategy = 'auto_rejected_no_active_candidates'
      summary.rejectedNoActive += 1

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('survey_response_matches')
          .update({
            cliente_id: null,
            needs_review: false,
            match_confidence: 'none',
            match_strategy: resolutionStrategy,
            matched_manually: true,
            match_notes: appendNotes(row.match_notes, 'Auto-resolved: no active candidate left after dedup cleanup.'),
            updated_at: new Date().toISOString()
          })
          .eq('id', row.match_id)

        if (updateError) throw new Error(`Failed to update match ${row.match_id}: ${updateError.message}`)
      }

      summary.resolved += 1
      continue
    }

    if (activeClients.length === 1) {
      resolvedClienteId = activeClients[0].id
      resolutionStrategy = 'auto_confirmed_single_active_candidate'
      summary.resolvedSingleActive += 1
    } else if (isIdentityEquivalentDuplicates(activeClients)) {
      const winner = await chooseWinnerClient(activeClients, busteCountCache)
      const preferredSurname = pickPreferredSurname(activeClients, winner.cognome)
      const losers = activeClients.filter((client) => client.id !== winner.id)

      if (!dryRun) {
        for (const loser of losers) {
          await mergeClientIntoWinner({
            winner,
            loser,
            preferredSurname,
            busteCountCache
          })
        }
      }

      resolvedClienteId = winner.id
      resolutionStrategy = 'auto_confirmed_identity_duplicate_merged'
      summary.resolvedMerged += 1
    } else {
      const respondentEmail = normalizeEmail(row.respondent_email || '')
      const respondentName = normalizeText(row.respondent_name || '')

      const byEmailAndName = activeClients.filter((client) => {
        const emailMatch = respondentEmail && normalizeEmail(client.email) === respondentEmail
        const fullForward = normalizeText(`${client.nome || ''} ${client.cognome || ''}`)
        const fullReverse = normalizeText(`${client.cognome || ''} ${client.nome || ''}`)
        const nameMatch = respondentName && (fullForward === respondentName || fullReverse === respondentName)
        return Boolean(emailMatch && nameMatch)
      })

      if (byEmailAndName.length === 1) {
        resolvedClienteId = byEmailAndName[0].id
        resolutionStrategy = 'auto_confirmed_unique_email_and_name'
        summary.resolvedUniqueByRespondent += 1
      } else {
        const byEmail = activeClients.filter((client) => respondentEmail && normalizeEmail(client.email) === respondentEmail)
        if (byEmail.length === 1) {
          resolvedClienteId = byEmail[0].id
          resolutionStrategy = 'auto_confirmed_unique_email'
          summary.resolvedUniqueByRespondent += 1
        } else {
          const byName = activeClients.filter((client) => {
            const fullForward = normalizeText(`${client.nome || ''} ${client.cognome || ''}`)
            const fullReverse = normalizeText(`${client.cognome || ''} ${client.nome || ''}`)
            return respondentName && (fullForward === respondentName || fullReverse === respondentName)
          })
          if (byName.length === 1) {
            resolvedClienteId = byName[0].id
            resolutionStrategy = 'auto_confirmed_unique_name'
            summary.resolvedUniqueByRespondent += 1
          }
        }
      }
    }

    if (!resolvedClienteId) {
      summary.skippedAmbiguous += 1
      continue
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('survey_response_matches')
        .update({
          cliente_id: resolvedClienteId,
          needs_review: false,
          matched_manually: true,
          match_strategy: resolutionStrategy,
          match_notes: appendNotes(row.match_notes, 'Auto-resolved in bulk cleanup.'),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.match_id)

      if (updateError) throw new Error(`Failed to update match ${row.match_id}: ${updateError.message}`)
    }

    summary.resolved += 1
  }

  console.log('--- Survey Match Auto-Resolve Summary ---')
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`Queue scanned: ${summary.totalQueue}`)
  console.log(`Resolved total: ${summary.resolved}`)
  console.log(`Resolved - single active candidate: ${summary.resolvedSingleActive}`)
  console.log(`Resolved - unique by respondent: ${summary.resolvedUniqueByRespondent}`)
  console.log(`Resolved - merged duplicates: ${summary.resolvedMerged}`)
  console.log(`Resolved - rejected no active: ${summary.rejectedNoActive}`)
  console.log(`Skipped ambiguous: ${summary.skippedAmbiguous}`)
}

run().catch((error) => {
  console.error('Survey bulk auto-resolve failed:', error)
  process.exit(1)
})
