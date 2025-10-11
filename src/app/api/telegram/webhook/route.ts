// src/app/api/telegram/webhook/route.ts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { transcribeFromBase64 } from '@/lib/transcription/assemblyai'

// Lazy import to avoid top-level ESM/CJS conflicts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js')

type SupabaseAdmin = ReturnType<typeof createClient>

type ParsedUpdate = {
  update: any
  messageType: string
  fromUser: any
  telegramUserId: string
  message: any
}

type ValidationResult = { botToken: string } | { response: NextResponse }

type AuthorizationResult = { authorizedUser: any } | { response: NextResponse }

// ===== Helpers =====
function jsonSafe<T>(v: T) {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return v
  }
}

function getSupabaseAdmin(): SupabaseAdmin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials missing')
  return createClient(url, key)
}

async function validateTelegramRequest(request: NextRequest): Promise<ValidationResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured')
    return {
      response: NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
    }
  }

  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (configuredSecret && providedSecret !== configuredSecret) {
    console.error('❌ Invalid Telegram webhook secret')
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return { botToken }
}

async function parseTelegramUpdate(request: NextRequest): Promise<ParsedUpdate | { response: NextResponse }> {
  try {
    const update = await request.json()
    if (!update) {
      return {
        response: NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      }
    }

    const mtype = messageType(update)
    const fromUser = update.message?.from || update.callback_query?.from
    const telegramUserId = String(fromUser?.id || '')
    const message = update.message

    console.log('📨 Telegram update:', jsonSafe({
      update_id: update.update_id,
      type: mtype,
      from: fromUser?.username || fromUser?.id || 'unknown'
    }))

    return { update, messageType: mtype, fromUser, telegramUserId, message }
  } catch (error: any) {
    console.error('❌ Failed to parse Telegram update:', error?.message)
    return {
      response: NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
  }
}

async function handleUnauthorizedUser(
  supabase: SupabaseAdmin,
  botToken: string,
  fromUser: any,
  telegramUserId: string
) {
  await supabase
    .from('telegram_auth_requests')
    .upsert(
      {
        telegram_user_id: telegramUserId,
        telegram_username: fromUser?.username || null,
        first_name: fromUser?.first_name || null,
        last_name: fromUser?.last_name || null,
        last_seen_at: new Date().toISOString(),
        message_count: 1,
      },
      {
        onConflict: 'telegram_user_id',
        ignoreDuplicates: false,
      }
    )

  const { error: incrementError } = await supabase.rpc('increment_message_count', {
    user_id: telegramUserId,
  })

  if (incrementError) {
    console.warn('⚠️ Failed to increment message count via RPC:', incrementError.message)
    const { data: existing, error: fetchError } = await supabase
      .from('telegram_auth_requests')
      .select('message_count')
      .eq('telegram_user_id', telegramUserId)
      .single()

    const currentCount = fetchError ? 0 : (existing?.message_count ?? 0)
    const nextCount = currentCount + 1
    const { error: updateError } = await supabase
      .from('telegram_auth_requests')
      .update({
        last_seen_at: new Date().toISOString(),
        message_count: nextCount,
      })
      .eq('telegram_user_id', telegramUserId)

    if (updateError) {
      console.error('❌ Failed to update message count fallback:', updateError.message)
    }
  }

  console.log('🚫 Unauthorized Telegram user:', telegramUserId, fromUser?.username)

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: fromUser?.id,
      text: '🔒 Non sei autorizzato ad usare questo bot.\n\nPer ottenere l\'accesso, contatta un amministratore e fornisci questo codice:\n\n`' + telegramUserId + '`',
      parse_mode: 'Markdown',
    }),
  })

  return NextResponse.json({ status: 'unauthorized' })
}

async function ensureAuthorizedUser(
  supabase: SupabaseAdmin,
  botToken: string,
  fromUser: any,
  telegramUserId: string
): Promise<AuthorizationResult> {
  const { data: allowedEntry, error: allowError } = await supabase
    .from('telegram_allowed_users')
    .select('profile_id, label')
    .eq('telegram_user_id', telegramUserId)
    .eq('can_use_bot', true)
    .maybeSingle()

  if (allowError) {
    console.error('❌ Allow-list lookup failed:', allowError.message)
  }

  console.log('🔐 Allow-list entry:', jsonSafe(allowedEntry))

  if (!allowedEntry?.profile_id) {
    const response = await handleUnauthorizedUser(supabase, botToken, fromUser, telegramUserId)
    return { response }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_bot_access, telegram_user_id')
    .eq('id', allowedEntry.profile_id)
    .maybeSingle()

  if (profileError) {
    console.error('❌ Profile lookup failed for allow-list entry:', profileError.message)
  }

  const profileData = profile || { id: allowedEntry.profile_id, full_name: allowedEntry.label, telegram_bot_access: false }

  if (!profileData.telegram_bot_access || profileData.telegram_user_id !== telegramUserId) {
    await supabase
      .from('profiles')
      .update({ telegram_bot_access: true, telegram_user_id: telegramUserId })
      .eq('id', allowedEntry.profile_id)
  }

  const displayName = profileData.full_name || allowedEntry.label || `Profile ${allowedEntry.profile_id}`
  console.log('✅ Authorized user:', displayName, '(' + telegramUserId + ')')

  return { authorizedUser: profileData }
}

async function telegramGetFile(botToken: string, fileId: string) {
  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  )
  if (!resp.ok) throw new Error(`getFile failed: ${resp.status}`)
  const data = await resp.json()
  if (!data.ok) throw new Error(`getFile error: ${data.description || 'unknown'}`)
  return data.result as { file_path: string; file_size?: number }
}

async function telegramDownloadBase64(botToken: string, filePath: string) {
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const resp = await fetch(fileUrl)
  if (!resp.ok) throw new Error(`file download failed: ${resp.status}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  return buf.toString('base64')
}

function messageType(update: any) {
  if (update.message?.voice) return 'voice'
  if (update.message?.audio) return 'audio'
  if (update.message?.document) return 'document'
  if (update.callback_query) return 'callback'
  if (update.message?.text) return 'text'
  return 'unknown'
}

async function fetchVoicePayload(botToken: string, message: any) {
  const fileObj = message.voice || message.audio || message.document
  const fileId: string = fileObj.file_id
  const duration: number = message.voice?.duration || message.audio?.duration || 0
  const fileSize: number = fileObj.file_size || 0

  const fileMeta = await telegramGetFile(botToken, fileId)
  const audioBase64 = await telegramDownloadBase64(botToken, fileMeta.file_path)

  return {
    audioBase64,
    duration,
    fileSize: fileSize || fileMeta.file_size || 0,
    telegramMessageId: String(message.message_id),
  }
}

async function isDuplicateVoiceNote(supabase: SupabaseAdmin, telegramMessageId: string) {
  const { data, error } = await supabase
    .from('voice_notes')
    .select('id')
    .eq('telegram_message_id', telegramMessageId)
    .limit(1)

  if (error) {
    console.error('⚠️ Idempotency check failed:', error.message)
    return false
  }

  return Boolean(data && data.length > 0)
}

function buildVoiceNotePayload(fromUser: any, audioBase64: string, duration: number, fileSize: number, messageId: string) {
  const operatorName =
    fromUser?.username || `${fromUser?.first_name || ''} ${fromUser?.last_name || ''}`.trim() || 'Telegram'

  return {
    audio_blob: audioBase64,
    addetto_nome: operatorName,
    note_aggiuntive: null,
    stato: 'processing',
    file_size: fileSize,
    duration_seconds: duration || 0,
    cliente_id: null,
    busta_id: null,
    telegram_message_id: messageId,
    telegram_user_id: String(fromUser?.id || ''),
    telegram_username: fromUser?.username || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function saveVoiceNoteRecord(
  supabase: SupabaseAdmin,
  payload: ReturnType<typeof buildVoiceNotePayload>
) {
  const { data, error } = await supabase
    .from('voice_notes')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('❌ Database save failed:', error.message)
    return { response: NextResponse.json({ status: 'saved_error', error: error.message }) }
  }

  return { voiceNoteId: data?.id }
}

async function transcribeVoiceNote(audioBase64: string) {
  try {
    console.log('🎙️ Starting auto-transcription...')
    const transcription = await transcribeFromBase64(audioBase64, 'audio/ogg')
    if (transcription && transcription.trim().length > 0) {
      console.log('✅ Transcription completed:', transcription.substring(0, 100) + '...')
      return { transcription, status: 'pending' as const }
    }

    console.log('⚠️ Transcription returned empty result')
    return { transcription: '', status: 'pending' as const }
  } catch (error: any) {
    console.error('❌ Auto-transcription failed:', error.message)

    if (error.message.includes('404') || error.message.includes('AssemblyAI')) {
      return {
        transcription:
          '[Trascrizione temporaneamente non disponibile - problema di rete con AssemblyAI. Audio salvato correttamente.]',
        status: 'pending' as const,
      }
    }

    return { transcription: '', status: 'failed' as const }
  }
}

async function updateVoiceNote(
  supabase: SupabaseAdmin,
  voiceNoteId: string | undefined,
  transcription: string,
  status: 'pending' | 'failed'
) {
  if (!voiceNoteId) return

  const { error } = await supabase
    .from('voice_notes')
    .update({
      transcription,
      stato: status,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', voiceNoteId)

  if (error) {
    console.error('❌ Failed to update transcription:', error.message)
  }
}

// ===== WEBHOOK HANDLER =====
export async function POST(request: NextRequest) {
  try {
    console.log('📡 Webhook request received')

    const validation = await validateTelegramRequest(request)
    if ('response' in validation) {
      return validation.response
    }

    const parsed = await parseTelegramUpdate(request)
    if ('response' in parsed) {
      return parsed.response
    }

    const { botToken } = validation
    const { update, messageType: mtype, fromUser, telegramUserId, message } = parsed

    const supabase = getSupabaseAdmin()
    const authorization = await ensureAuthorizedUser(supabase, botToken, fromUser, telegramUserId)
    if ('response' in authorization) {
      return authorization.response
    }

    if (!['voice', 'audio', 'document'].includes(mtype)) {
      return NextResponse.json({ status: 'ignored' })
    }

    const payload = await fetchVoicePayload(botToken, message)

    const isDuplicate = await isDuplicateVoiceNote(supabase, payload.telegramMessageId)
    if (isDuplicate) {
      console.log('↩️ Duplicate update: voice_note already saved')
      return NextResponse.json({ status: 'ok_duplicate' })
    }

    const voiceNotePayload = buildVoiceNotePayload(
      fromUser,
      payload.audioBase64,
      payload.duration,
      payload.fileSize,
      payload.telegramMessageId
    )

    const saveResult = await saveVoiceNoteRecord(supabase, voiceNotePayload)
    if ('response' in saveResult) {
      return saveResult.response
    }

    console.log('✅ Voice note saved, starting transcription:', saveResult.voiceNoteId)

    const { transcription, status } = await transcribeVoiceNote(payload.audioBase64)
    await updateVoiceNote(supabase, saveResult.voiceNoteId, transcription, status)

    console.log('✅ Voice note processed with auto-transcription:', saveResult.voiceNoteId)
    return NextResponse.json({
      status: 'ok_processed',
      id: saveResult.voiceNoteId,
      transcription: transcription ? 'success' : 'failed',
    })
  } catch (error: any) {
    console.error('🔥 Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// ===== WEBHOOK SETUP/INFO (GET) =====
export async function GET(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const webhookUrl = 'https://ob-gestionale-2025.vercel.app/api/telegram/webhook'

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const webhookInfo = await response.json()

    const info = {
      configured: {
        bot_token: botToken ? '✅ Configured' : '❌ Missing',
        webhook_url: webhookUrl || '❌ Not set',
        environment: process.env.NODE_ENV || 'unknown',
      },
      telegram_webhook: webhookInfo.result || {},
      bot_instance: 'n/a (direct handler)',
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(info)
  } catch (error: any) {
    console.error('❌ Webhook info error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook info', details: error.message },
      { status: 500 }
    )
  }
}

// ===== WEBHOOK SETUP (PUT) =====
export async function PUT(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const webhookUrl = 'https://ob-gestionale-2025.vercel.app/api/telegram/webhook'

    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    console.log('🔧 Setting up Telegram webhook:', webhookUrl)

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      }),
    })

    const result = await response.json()

    if (result.ok) {
      console.log('✅ Telegram webhook configured successfully')
      return NextResponse.json({
        success: true,
        message: 'Webhook configured successfully',
        webhook_url: webhookUrl,
        result: result.result,
      })
    }

    console.error('❌ Failed to set webhook:', result)
    return NextResponse.json(
      { error: 'Failed to set webhook', details: result },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('❌ Webhook setup error:', error)
    return NextResponse.json(
      { error: 'Webhook setup failed', details: error.message },
      { status: 500 }
    )
  }
}

// ===== DELETE WEBHOOK (DELETE) =====
export async function DELETE(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    console.log('🗑️ Deleting Telegram webhook')

    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
    })

    const result = await response.json()

    if (result.ok) {
      console.log('✅ Telegram webhook deleted successfully')
      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully',
      })
    }

    return NextResponse.json(
      { error: 'Failed to delete webhook', details: result },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('❌ Webhook deletion error:', error)
    return NextResponse.json(
      { error: 'Webhook deletion failed', details: error.message },
      { status: 500 }
    )
  }
}
