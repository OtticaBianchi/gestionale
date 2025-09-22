export const dynamic = 'force-dynamic' 
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

type VoiceNote = {
  id: string
  audio_blob?: string | null
  audio_file_path?: string | null
  transcription?: string | null
  note_aggiuntive?: string | null
  busta_id?: string | null
}

type SupabaseServiceClient = ReturnType<typeof createClient>

const ALLOWED_FIELDS = [
  'transcription',
  'stato',
  'processed_by',
  'cliente_id',
  'busta_id',
  'redo_transcription',
] as const

type PatchPayload = Partial<Record<(typeof ALLOWED_FIELDS)[number], unknown>>

async function ensureAdminOrManager() {
  const serverClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }
  }

  const { data: me } = await serverClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || !['admin', 'manager'].includes(me.role)) {
    return {
      response: NextResponse.json({ error: 'Solo amministratori o manager possono modificare le note vocali' }, {
        status: 403,
      }),
    }
  }

  return {
    serviceClient: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as SupabaseServiceClient,
  }
}

async function parsePatchBody(request: NextRequest) {
  try {
    const body: PatchPayload = await request.json()
    const hasUnknownKeys = Object.keys(body).some((key) => !ALLOWED_FIELDS.includes(key as any))
    if (hasUnknownKeys) {
      return { response: NextResponse.json({ error: 'Campi non supportati nel payload' }, { status: 400 }) }
    }
    return { body }
  } catch {
    return { response: NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  }
}

function buildUpdateData(body: PatchPayload) {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.transcription !== undefined) {
    updateData.transcription = body.transcription
  }

  if (body.stato !== undefined) {
    updateData.stato = body.stato
    if (body.stato === 'completed' || body.stato === 'failed') {
      updateData.processed_at = new Date().toISOString()
    }
  }

  if (body.processed_by !== undefined) {
    updateData.processed_by = body.processed_by
  }

  if (body.cliente_id !== undefined) {
    updateData.cliente_id = body.cliente_id
  }

  if (body.busta_id !== undefined) {
    updateData.busta_id = body.busta_id
  }

  return updateData
}

async function safeTranscribeIfRequested(supabase: SupabaseServiceClient, noteId: string, redo: boolean) {
  const { data: latestNote } = await supabase
    .from('voice_notes')
    .select('*')
    .eq('id', noteId)
    .single()

  if (!latestNote) {
    return { text: '', note: null as VoiceNote | null }
  }

  const note = latestNote as VoiceNote

  if (!redo) {
    const existing = note.transcription || note.note_aggiuntive || ''
    return { text: existing, note }
  }

  if (!note.audio_blob) {
    const existing = note.transcription || note.note_aggiuntive || ''
    return { text: existing, note }
  }

  try {
    console.log('🔄 Starting transcription with AssemblyAI...')
    const { transcribeFromBase64 } = await import('@/lib/transcription/assemblyai')
    const path = (note.audio_file_path || '').toLowerCase()
    const inferredMime = path.endsWith('.webm')
      ? 'audio/webm'
      : path.endsWith('.mp3')
        ? 'audio/mpeg'
        : path.endsWith('.m4a') || path.endsWith('.aac')
          ? 'audio/m4a'
          : 'audio/ogg'
    const text = await transcribeFromBase64(note.audio_blob, inferredMime)
    return { text: text || '', note }
  } catch (error) {
    console.error('❌ Transcription redo failed:', error)
    const fallback = note.transcription || note.note_aggiuntive || ''
    return { text: fallback, note }
  }
}

async function updateBustaNotes(
  supabase: SupabaseServiceClient,
  bustaId: string,
  noteId: string,
  text: string,
  redoTranscription: boolean
) {
  const { data: busta } = await supabase
    .from('buste')
    .select('note_generali')
    .eq('id', bustaId)
    .single()

  const existingNotes = typeof busta?.note_generali === 'string' ? busta.note_generali : ''
  const marker = `[VoiceNote ${noteId}]`
  const nowStr = new Date().toLocaleString('it-IT')
  const newBlock = `${marker} Nota vocale collegata il ${nowStr}\n${text || '(nessuna trascrizione)'}\n`

  const start = existingNotes.indexOf(marker)

  if (start === -1) {
    const newNotes = (existingNotes ? `${existingNotes}\n\n` : '') + newBlock
    await supabase
      .from('buste')
      .update({ note_generali: newNotes, updated_at: new Date().toISOString() })
      .eq('id', bustaId)
    return
  }

  if (!redoTranscription || !text.trim()) {
    return
  }

  const afterStart = existingNotes.slice(start)
  const separatorIndex = afterStart.indexOf('\n\n')
  const end = separatorIndex === -1 ? existingNotes.length : start + separatorIndex
  const before = existingNotes.slice(0, start)
  const after = existingNotes.slice(end)
  const updatedNotes = (before + newBlock + (after.startsWith('\n\n') ? after : after ? `\n\n${after}` : '')).trim()

  await supabase
    .from('buste')
    .update({ note_generali: updatedNotes, updated_at: new Date().toISOString() })
    .eq('id', bustaId)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await ensureAdminOrManager()
    if (authResult.response) {
      return authResult.response
    }

    const { body: payload, response: parseError } = await parsePatchBody(request)
    if (parseError) {
      return parseError
    }

    const { id } = await params
    const updateData = buildUpdateData(payload || {})

    const { data, error } = await authResult.serviceClient
      .from('voice_notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Errore aggiornamento nota vocale' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Nota vocale non trovata' }, { status: 404 })
    }

    const redoTranscription = Boolean(payload?.redo_transcription)
    const targetBustaId = (payload?.busta_id || data.busta_id) as string | undefined

    if (targetBustaId) {
      const { text, note } = await safeTranscribeIfRequested(authResult.serviceClient, id, redoTranscription)

      if (redoTranscription && note && text && text !== note.transcription) {
        await authResult.serviceClient
          .from('voice_notes')
          .update({ transcription: text, updated_at: new Date().toISOString() })
          .eq('id', id)
      }

      if (note) {
        await updateBustaNotes(authResult.serviceClient, targetBustaId, id, text, redoTranscription)
      }
    }

    return NextResponse.json({
      success: true,
      note: data,
      message: 'Nota vocale aggiornata con successo',
    });

  } catch (error) {
    console.error('Voice note update error:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // First, ensure the caller is admin using regular client
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({
        error: 'Solo gli amministratori possono eliminare le note vocali'
      }, { status: 403 });
    }

    // Use service role client after admin check to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await params;

    // Unified deletion: dismiss from UI + clear audio but preserve metadata
    const { error } = await supabase
      .from('voice_notes')
      .update({
        dismissed_at: new Date().toISOString(), // Hide from dashboard
        audio_blob: '', // Clear audio to save space
        file_size: 0, // Reset file size
        updated_at: new Date().toISOString()
        // Keep transcription, metadata, and all other fields for history
      })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore dismissing nota vocale' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Nota vocale rimossa dalla dashboard (dati conservati)' 
    });

  } catch (error) {
    console.error('Voice note dismiss error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure the caller is admin
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({
        error: 'Solo gli amministratori possono accedere alle note vocali'
      }, { status: 403 });
    }

    // Use service role client after admin check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await params;

    const { data, error } = await supabase
      .from('voice_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore recupero nota vocale' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Nota vocale non trovata' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      note: data
    });

  } catch (error) {
    console.error('Voice note fetch error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
