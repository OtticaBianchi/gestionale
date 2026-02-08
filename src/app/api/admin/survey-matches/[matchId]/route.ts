export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const projectRoot = process.cwd()
const databaseTypesPath = path.join(projectRoot, 'src', 'types', 'database.types.ts')

const COVERED_AUTO_MERGE_TABLES = new Set([
  'buste',
  'error_tracking',
  'voice_notes',
  'survey_response_matches'
])

let clienteIdTablesPromise: Promise<string[]> | null = null

type ResolvePayload = {
  cliente_id?: string | null
  approve?: boolean
  notes?: string | null
}

type MatchClient = {
  id: string
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
  data_nascita: string | null
  note_cliente: string | null
  created_at: string | null
  deleted_at: string | null
}

type MergeBlocker = {
  table: string
  count: number | null
  error: string | null
}

const normalizeText = (value: string | null | undefined) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeLooseText = (value: string | null | undefined) => (value || '').trim().toLowerCase()
const normalizeEmail = (value: string | null | undefined) => (value || '').trim().toLowerCase()
const normalizePhoneDigits = (value: string | null | undefined) => (value || '').replace(/[^\d]/g, '')
const hasAccentedVowel = (value: string | null | undefined) => /[àèéìòùÀÈÉÌÒÙ]/.test(value || '')
const tokenizeName = (value: string | null | undefined) =>
  normalizeText(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
const fullNameTokenKey = (nome: string | null | undefined, cognome: string | null | undefined) =>
  tokenizeName(`${nome || ''} ${cognome || ''}`)
    .sort()
    .join(' ')

const convertApostropheVowelsToAccents = (value: string | null | undefined) => {
  if (!value) return value || ''
  const accentMap: Record<string, string> = {
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
  return value.replace(/([aeiouAEIOU])[’'](?=[\s.,;:!?)]|$)/g, (_, vowel: string) => accentMap[vowel] || vowel)
}

const appendNotes = (base: string | null | undefined, extra: string) => {
  const cleanBase = (base || '').trim()
  const cleanExtra = extra.trim()
  if (!cleanBase) return cleanExtra
  if (!cleanExtra) return cleanBase
  return `${cleanBase}\n${cleanExtra}`
}

const isMissingTableError = (error: any) => {
  const message = `${error?.message || ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('does not exist') || message.includes('could not find the table')
}

const discoverClienteIdTablesFromTypes = async (): Promise<string[]> => {
  const fallback = [...COVERED_AUTO_MERGE_TABLES]

  try {
    const content = await fs.readFile(databaseTypesPath, 'utf8')
    const lines = content.split(/\r?\n/)
    const tables = new Set<string>()
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
    console.warn('Could not discover cliente_id tables from types file. Falling back to covered merge tables.')
    return fallback
  }
}

const getClienteIdTables = async () => {
  if (!clienteIdTablesPromise) {
    clienteIdTablesPromise = discoverClienteIdTablesFromTypes()
  }
  return clienteIdTablesPromise
}

const getExternalReferenceBlockers = async (
  admin: any,
  clientId: string,
  cache: Map<string, MergeBlocker[]>
) => {
  if (cache.has(clientId)) return cache.get(clientId) || []

  const tablesWithClienteId = await getClienteIdTables()
  const externalTables = tablesWithClienteId.filter((tableName) => !COVERED_AUTO_MERGE_TABLES.has(tableName))
  const blockers: MergeBlocker[] = []

  for (const tableName of externalTables) {
    const { count, error } = await admin
      .from(tableName)
      .select('cliente_id', { count: 'exact', head: true })
      .eq('cliente_id', clientId)

    if (error) {
      if (isMissingTableError(error)) continue
      blockers.push({ table: tableName, count: null, error: error.message })
      continue
    }

    const refs = count || 0
    if (refs > 0) {
      blockers.push({ table: tableName, count: refs, error: null })
    }
  }

  cache.set(clientId, blockers)
  return blockers
}

const formatBlockersForNote = (blockers: MergeBlocker[]) =>
  blockers
    .map((entry) => (entry.error ? `${entry.table}:error` : `${entry.table}:${entry.count || 0}`))
    .join(', ')

const areOrthographicVariants = (clients: MatchClient[]) => {
  const active = clients.filter((client) => !client.deleted_at)
  if (active.length < 2) return false

  const emailSet = new Set(active.map((client) => normalizeEmail(client.email)).filter(Boolean))
  if (emailSet.size !== 1) return false

  const fullNameKeys = new Set(active.map((client) => fullNameTokenKey(client.nome, client.cognome)).filter(Boolean))
  if (fullNameKeys.size !== 1) return false

  const phoneSet = new Set(active.map((client) => normalizePhoneDigits(client.telefono)).filter((value) => value.length > 0))
  if (phoneSet.size > 1) return false

  const birthSet = new Set(active.map((client) => client.data_nascita).filter(Boolean))
  if (birthSet.size > 1) return false

  const notesSet = new Set(active.map((client) => normalizeLooseText(client.note_cliente)).filter((value) => value.length > 0))
  if (notesSet.size > 1) return false

  return true
}

const getBusteCount = async (admin: any, clientId: string) => {
  const { count, error } = await admin
    .from('buste')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clientId)
    .is('deleted_at', null)

  if (error) throw new Error(`Failed counting buste for ${clientId}: ${error.message}`)
  return count || 0
}

const chooseMergeWinner = async (admin: any, clients: MatchClient[]) => {
  const scored = await Promise.all(
    clients.map(async (client) => ({
      client,
      busteCount: await getBusteCount(admin, client.id)
    }))
  )

  scored.sort((a, b) => {
    if (b.busteCount !== a.busteCount) return b.busteCount - a.busteCount
    const aAccent = hasAccentedVowel(a.client.cognome)
    const bAccent = hasAccentedVowel(b.client.cognome)
    if (aAccent !== bAccent) return aAccent ? -1 : 1
    const aCreated = a.client.created_at ? new Date(a.client.created_at).getTime() : Number.MAX_SAFE_INTEGER
    const bCreated = b.client.created_at ? new Date(b.client.created_at).getTime() : Number.MAX_SAFE_INTEGER
    if (aCreated !== bCreated) return aCreated - bCreated
    return a.client.id.localeCompare(b.client.id)
  })

  return {
    winner: scored[0].client,
    losers: scored.slice(1).map((item) => item.client)
  }
}

const pickPreferredSurname = (clients: MatchClient[], fallback: string | null | undefined) => {
  for (const client of clients) {
    if (hasAccentedVowel(client.cognome)) return client.cognome || ''
  }
  for (const client of clients) {
    const converted = convertApostropheVowelsToAccents(client.cognome)
    if (hasAccentedVowel(converted)) return converted
  }
  return convertApostropheVowelsToAccents(fallback)
}

const mergeOrthographicDuplicates = async ({
  admin,
  reviewerId,
  clients
}: {
  admin: any
  reviewerId: string
  clients: MatchClient[]
}) => {
  const now = new Date().toISOString()
  const { winner, losers } = await chooseMergeWinner(admin, clients)
  const externalReferenceCache = new Map<string, MergeBlocker[]>()
  const blockedLosers: Array<{ loserId: string; blockers: MergeBlocker[] }> = []

  for (const loser of losers) {
    const blockers = await getExternalReferenceBlockers(admin, loser.id, externalReferenceCache)
    if (blockers.length > 0) {
      blockedLosers.push({
        loserId: loser.id,
        blockers
      })
    }
  }

  if (blockedLosers.length > 0) {
    return {
      winnerId: winner.id,
      mergedCount: 0,
      blockedLosers
    }
  }

  const preferredSurname = pickPreferredSurname(clients, winner.cognome)

  const winnerPatch: Record<string, any> = { updated_at: now, updated_by: reviewerId }
  if (preferredSurname && preferredSurname !== winner.cognome) winnerPatch.cognome = preferredSurname

  for (const loser of losers) {
    if (!winnerPatch.telefono && loser.telefono) winnerPatch.telefono = loser.telefono
    if (!winnerPatch.email && loser.email && !winner.email) winnerPatch.email = loser.email
    if (!winnerPatch.data_nascita && loser.data_nascita && !winner.data_nascita) winnerPatch.data_nascita = loser.data_nascita
    if (!winnerPatch.note_cliente && loser.note_cliente && !winner.note_cliente) winnerPatch.note_cliente = loser.note_cliente
  }

  const { error: winnerUpdateError } = await admin
    .from('clienti')
    .update(winnerPatch)
    .eq('id', winner.id)

  if (winnerUpdateError) {
    throw new Error(`Failed updating winner ${winner.id}: ${winnerUpdateError.message}`)
  }

  for (const loser of losers) {
    const { error: busteError } = await admin
      .from('buste')
      .update({ cliente_id: winner.id, updated_at: now, updated_by: reviewerId })
      .eq('cliente_id', loser.id)
    if (busteError) throw new Error(`Failed moving buste ${loser.id}: ${busteError.message}`)

    const { error: errorTrackingError } = await admin
      .from('error_tracking')
      .update({ cliente_id: winner.id, updated_at: now })
      .eq('cliente_id', loser.id)
    if (errorTrackingError) throw new Error(`Failed moving error_tracking ${loser.id}: ${errorTrackingError.message}`)

    const { error: voiceNotesError } = await admin
      .from('voice_notes')
      .update({ cliente_id: winner.id, updated_at: now })
      .eq('cliente_id', loser.id)
    if (voiceNotesError) throw new Error(`Failed moving voice_notes ${loser.id}: ${voiceNotesError.message}`)

    const { error: surveyMatchesError } = await admin
      .from('survey_response_matches')
      .update({ cliente_id: winner.id, updated_at: now })
      .eq('cliente_id', loser.id)
    if (surveyMatchesError) throw new Error(`Failed moving survey matches ${loser.id}: ${surveyMatchesError.message}`)

    const { error: deleteError } = await admin
      .from('clienti')
      .update({
        deleted_at: now,
        deleted_by: reviewerId,
        updated_at: now,
        updated_by: reviewerId
      })
      .eq('id', loser.id)
      .is('deleted_at', null)

    if (deleteError) throw new Error(`Failed deleting loser ${loser.id}: ${deleteError.message}`)
  }

  return {
    winnerId: winner.id,
    mergedCount: losers.length,
    blockedLosers: [] as Array<{ loserId: string; blockers: MergeBlocker[] }>
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
    }

    const payload = (await request.json()) as ResolvePayload
    const { matchId } = await params

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: existing, error: fetchError } = await admin
      .from('survey_response_matches')
      .select('id, cliente_id, match_confidence, match_strategy, needs_review, match_notes, candidate_client_ids')
      .eq('id', matchId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Match non trovato' }, { status: 404 })
    }

    const approve = payload.approve !== false
    const updateData: Record<string, any> = {
      needs_review: false,
      matched_manually: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      match_notes: payload.notes || existing.match_notes || null
    }

    if (approve && payload.cliente_id) {
      let resolvedClienteId = payload.cliente_id
      const candidateIds = Array.from(new Set([
        payload.cliente_id,
        ...((Array.isArray(existing.candidate_client_ids) ? existing.candidate_client_ids : []) as string[])
      ]))

      const { data: candidates, error: candidatesError } = await admin
        .from('clienti')
        .select('id, nome, cognome, email, telefono, data_nascita, note_cliente, created_at, deleted_at')
        .in('id', candidateIds)

      if (candidatesError) {
        return NextResponse.json({ error: 'Errore recupero candidati cliente' }, { status: 500 })
      }

      const allCandidates = (candidates || []) as MatchClient[]
      const activeCandidates = allCandidates.filter((candidate) => !candidate.deleted_at)
      const selectedIsActive = activeCandidates.some((candidate) => candidate.id === payload.cliente_id)

      if (!selectedIsActive) {
        if (activeCandidates.length === 1) {
          resolvedClienteId = activeCandidates[0].id
          updateData.match_notes = appendNotes(
            updateData.match_notes,
            'Candidato selezionato eliminato: associazione riallineata automaticamente al record attivo.'
          )
        } else {
          return NextResponse.json(
            {
              error: 'Il cliente selezionato è eliminato. Seleziona un cliente attivo.',
              code: 'CLIENT_DELETED',
              active_candidate_ids: activeCandidates.map((candidate) => candidate.id)
            },
            { status: 409 }
          )
        }
      }

      if (activeCandidates.length > 1 && areOrthographicVariants(activeCandidates)) {
        const mergeResult = await mergeOrthographicDuplicates({
          admin,
          reviewerId: user.id,
          clients: activeCandidates
        })

        if (mergeResult.blockedLosers.length > 0) {
          updateData.match_notes = appendNotes(
            updateData.match_notes,
            `Auto-merge ortografico NON eseguito (guardrail): ${mergeResult.blockedLosers.map((entry) => `${entry.loserId}[${formatBlockersForNote(entry.blockers)}]`).join(' | ')}`
          )
          updateData.match_strategy = 'manual_confirmed_orthographic_guardrail_skip'
        } else {
          resolvedClienteId = mergeResult.winnerId
          updateData.match_notes = appendNotes(
            updateData.match_notes,
            `Auto-merge ortografico eseguito (${mergeResult.mergedCount} record unificati).`
          )
          updateData.match_strategy = 'manual_confirmed_orthographic_merged'
        }
      }

      updateData.cliente_id = resolvedClienteId
      if (!['high', 'medium'].includes(existing.match_confidence)) {
        updateData.match_confidence = 'medium'
      }
      if (!updateData.match_strategy) {
        updateData.match_strategy = 'manual_confirmed'
      }
    } else if (approve && !payload.cliente_id && existing.cliente_id) {
      updateData.match_strategy = 'manual_confirmed'
    } else {
      updateData.cliente_id = null
      updateData.match_confidence = 'none'
      updateData.match_strategy = 'manual_rejected'
    }

    const { data, error } = await admin
      .from('survey_response_matches')
      .update(updateData)
      .eq('id', matchId)
      .select('*')
      .single()

    if (error) {
      console.error('PATCH /api/admin/survey-matches/[matchId] error:', error)
      return NextResponse.json({ error: 'Errore salvataggio revisione match' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('PATCH /api/admin/survey-matches/[matchId] fatal error:', error)
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 })
  }
}
