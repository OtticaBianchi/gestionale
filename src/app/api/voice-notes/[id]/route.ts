export const dynamic = 'force-dynamic' 
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

async function safeTranscribeIfRequested(note: any, redo: boolean) {
  try {
    console.log('🎙️ safeTranscribeIfRequested:', { 
      noteId: note.id, 
      redo, 
      hasAudio: !!note?.audio_blob,
      existingTranscription: !!note.transcription,
      existingNotes: !!note.note_aggiuntive
    });
    
    if (!redo) {
      const existing = note.transcription || note.note_aggiuntive || '';
      console.log('📝 No redo requested, returning existing:', existing.substring(0, 100));
      return existing;
    }
    
    if (!note?.audio_blob) {
      console.log('❌ No audio_blob found for transcription');
      return note.transcription || note.note_aggiuntive || '';
    }
    
    console.log('🔄 Starting transcription with AssemblyAI...');
    const { transcribeFromBase64 } = await import('@/lib/transcription/assemblyai');
    // Try to infer mime type from path; default to ogg (Telegram voice)
    const path: string = (note.audio_file_path || '').toLowerCase();
    const inferredMime = path.endsWith('.webm')
      ? 'audio/webm'
      : path.endsWith('.mp3')
        ? 'audio/mpeg'
        : path.endsWith('.m4a') || path.endsWith('.aac')
          ? 'audio/m4a'
          : 'audio/ogg';
    const text = await transcribeFromBase64(note.audio_blob, inferredMime);
    console.log('✅ Transcription completed:', text?.substring(0, 100) + '...');
    
    return text || note.transcription || note.note_aggiuntive || '';
  } catch (e) {
    console.error('❌ Transcription redo failed:', e);
    return note.transcription || note.note_aggiuntive || '';
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First, ensure the caller is admin
    const serverClient = createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    const { data: me } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!me || !['admin', 'manager'].includes(me.role)) {
      return NextResponse.json({ error: 'Solo amministratori o manager possono modificare le note vocali' }, { status: 403 });
    }
    // Use service role client after admin check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = params;
    const body = await request.json();
    
    const { transcription, stato, processed_by, cliente_id, busta_id, redo_transcription } = body;

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (transcription !== undefined) {
      updateData.transcription = transcription;
    }

    if (stato !== undefined) {
      updateData.stato = stato;
      
      if (stato === 'completed' || stato === 'failed') {
        updateData.processed_at = new Date().toISOString();
      }
    }

    if (processed_by !== undefined) {
      updateData.processed_by = processed_by;
    }

    if (cliente_id !== undefined) {
      updateData.cliente_id = cliente_id;
    }

    if (busta_id !== undefined) {
      updateData.busta_id = busta_id;
    }

    const { data, error } = await supabase
      .from('voice_notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore aggiornamento nota vocale' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Nota vocale non trovata' }, { status: 404 });
    }

    // If linked to a busta, optionally redo transcription and append/update in busta.note_generali
    if (busta_id || data.busta_id) {
      const bustaId = (busta_id || data.busta_id) as string;
      // Fetch latest note (ensure we have audio_blob, etc.)
      const { data: latestNote } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('id', id)
        .single();

      // Compute text (redo if requested and possible)
      const text = await safeTranscribeIfRequested(latestNote, !!redo_transcription);

      // Update voice note transcription if redone
      if (redo_transcription && text && text !== latestNote?.transcription) {
        await supabase
          .from('voice_notes')
          .update({ transcription: text, updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      // Append first time, then update block content if a later transcription succeeds
      const marker = `[VoiceNote ${id}]`;
      const { data: busta } = await supabase
        .from('buste')
        .select('note_generali')
        .eq('id', bustaId)
        .single();

      const existingNotes = busta?.note_generali || '';
      const start = existingNotes.indexOf(marker);
      const nowStr = new Date().toLocaleString('it-IT');
      const newBlock = `${marker} Nota vocale collegata il ${nowStr}\n${text || '(nessuna trascrizione)'}\n`;

      if (start === -1) {
        // First append
        const newNotes = (existingNotes ? existingNotes + '\n\n' : '') + newBlock;
        await supabase
          .from('buste')
          .update({ note_generali: newNotes, updated_at: new Date().toISOString() })
          .eq('id', bustaId);
      } else if (redo_transcription && text && text.trim().length > 0) {
        // Replace the existing block content with the fresh transcription
        // Find the end of the block: next blank line (\n\n) or end of string
        const afterStart = existingNotes.slice(start);
        const sepIdx = afterStart.indexOf('\n\n');
        const end = sepIdx === -1 ? existingNotes.length : start + sepIdx;
        const before = existingNotes.slice(0, start);
        const after = existingNotes.slice(end);
        const updatedNotes = (before + newBlock + (after.startsWith('\n\n') ? after : (after ? '\n\n' + after : ''))).trim();
        await supabase
          .from('buste')
          .update({ note_generali: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', bustaId);
      }
    }

    return NextResponse.json({
      success: true,
      note: data,
      message: 'Nota vocale aggiornata con successo',
    });

  } catch (error) {
    console.error('Voice note update error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // First, ensure the caller is admin using regular client
    const serverClient = createServerSupabaseClient();
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
    const { id } = params;

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
  { params }: { params: { id: string } }
) {
  try {
    // Ensure the caller is admin
    const serverClient = createServerSupabaseClient();
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
    const { id } = params;

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
