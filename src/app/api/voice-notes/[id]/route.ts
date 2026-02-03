export const dynamic = 'force-dynamic' 
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logUpdate } from '@/lib/audit/auditLog'

type VoiceNote = {
  id: string
  audio_blob?: string | null
  audio_file_path?: string | null
  transcription?: string | null
  note_aggiuntive?: string | null
  busta_id?: string | null
  cliente_id?: string | null
  stato?: string | null
  dismissed_at?: string | null
  processed_by?: string | null
  processed_at?: string | null
}

type SupabaseServiceClient = ReturnType<typeof createClient>
type AdminCheckResult =
  | { response: NextResponse }
  | { serviceClient: SupabaseServiceClient; userId: string; role: string }

const ALLOWED_FIELDS = [
  'transcription',
  'stato',
  'processed_by',
  'cliente_id',
  'busta_id',
  'redo_transcription',
] as const

type PatchPayload = Partial<Record<(typeof ALLOWED_FIELDS)[number], unknown>>

async function ensureAdminOrManager(): Promise<AdminCheckResult> {
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
    userId: user.id,
    role: me.role,
    serviceClient: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as SupabaseServiceClient,
  }
}

const pickVoiceNoteAuditFields = (note: Partial<VoiceNote> | null | undefined) => ({
  stato: note?.stato ?? null,
  transcription: note?.transcription ?? null,
  cliente_id: note?.cliente_id ?? null,
  busta_id: note?.busta_id ?? null,
  dismissed_at: note?.dismissed_at ?? null,
  processed_by: note?.processed_by ?? null,
  processed_at: note?.processed_at ?? null
})

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
    if ('response' in authResult) {
      return authResult.response
    }

    const { body: payload, response: parseError } = await parsePatchBody(request)
    if (parseError) {
      return parseError
    }

    const { id } = await params

    const { data: existingNote, error: fetchError } = await authResult.serviceClient
      .from('voice_notes')
      .select('id, stato, transcription, cliente_id, busta_id, dismissed_at, processed_by, processed_at')
      .eq('id', id)
      .single()

    if (fetchError || !existingNote) {
      console.error('Voice note not found for audit:', fetchError)
      return NextResponse.json({ error: 'Nota vocale non trovata' }, { status: 404 })
    }

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

    const auditUpdate = await logUpdate(
      'voice_notes',
      id,
      authResult.userId,
      pickVoiceNoteAuditFields(existingNote as VoiceNote),
      pickVoiceNoteAuditFields(data as VoiceNote),
      'Aggiornamento nota vocale',
      {
        source: 'api/voice-notes/[id]',
        fields: Object.keys(updateData)
      },
      authResult.role
    )

    if (!auditUpdate.success) {
      console.error('AUDIT_UPDATE_VOICE_NOTE_FAILED', auditUpdate.error)
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
    // First, ensure the caller is admin or manager using regular client
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
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({
        error: 'Solo gli amministratori o manager possono eliminare le note vocali'
      }, { status: 403 });
    }

    // Use service role client after admin check to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await params;

    const { data: existingNote, error: fetchExistingError } = await supabase
      .from('voice_notes')
      .select('id, stato, transcription, cliente_id, busta_id, dismissed_at, processed_by, processed_at')
      .eq('id', id)
      .single();

    if (fetchExistingError || !existingNote) {
      console.error('Voice note not found for dismiss:', fetchExistingError);
      return NextResponse.json({ error: 'Nota vocale non trovata' }, { status: 404 });
    }

    // Unified deletion: dismiss from UI + clear audio but preserve metadata
    const dismissedAt = new Date().toISOString();

    const { error } = await supabase
      .from('voice_notes')
      .update({
        dismissed_at: dismissedAt, // Hide from dashboard
        audio_blob: '', // Clear audio to save space
        file_size: 0, // Reset file size
        updated_at: dismissedAt
        // Keep transcription, metadata, and all other fields for history
      })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore dismissing nota vocale' }, { status: 500 });
    }

    const dismissedSnapshot: VoiceNote = {
      ...(existingNote as VoiceNote),
      dismissed_at: dismissedAt
    }

    const auditDismiss = await logUpdate(
      'voice_notes',
      id,
      user.id,
      pickVoiceNoteAuditFields(existingNote as VoiceNote),
      pickVoiceNoteAuditFields(dismissedSnapshot),
      'Dismiss nota vocale',
      {
        source: 'api/voice-notes/[id]',
        action: 'dismiss'
      },
      profile.role
    )

    if (!auditDismiss.success) {
      console.error('AUDIT_DISMISS_VOICE_NOTE_FAILED', auditDismiss.error)
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
    // Ensure the caller is admin or manager
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
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({
        error: 'Solo gli amministratori o manager possono accedere alle note vocali'
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
