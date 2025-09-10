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
    const text = await transcribeFromBase64(note.audio_blob, 'audio/ogg'); // Changed from webm to ogg for Telegram
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
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli amministratori possono modificare le note vocali' }, { status: 403 });
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

    // If linked to a busta, optionally redo transcription and append to busta.note_generali
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

      // Append to busta.note_generali once (idempotent)
      const marker = `[VoiceNote ${id}]`;
      const { data: busta } = await supabase
        .from('buste')
        .select('note_generali')
        .eq('id', bustaId)
        .single();

      const already = (busta?.note_generali || '').includes(marker);
      if (!already) {
        const nowStr = new Date().toLocaleString('it-IT');
        const block = `${marker} Nota vocale collegata il ${nowStr}\n${text || '(nessuna trascrizione)'}\n`;
        const newNotes = (busta?.note_generali ? busta.note_generali + '\n\n' : '') + block;
        await supabase
          .from('buste')
          .update({ note_generali: newNotes, updated_at: new Date().toISOString() })
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

    const { error } = await supabase
      .from('voice_notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore eliminazione nota vocale' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Nota vocale eliminata con successo' 
    });

  } catch (error) {
    console.error('Voice note delete error:', error);
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
