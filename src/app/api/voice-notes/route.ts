import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { apiRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (rateLimitResult) return rateLimitResult;
  try {
    const supabase = createServerSupabaseClient();
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const addetto_nome = formData.get('addetto_nome') as string;
    const note_aggiuntive = formData.get('note_aggiuntive') as string;
    const duration_seconds = formData.get('duration_seconds') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'File audio mancante' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return NextResponse.json({ error: 'File troppo grande (max 5MB)' }, { status: 400 });
    }

    // Validate duration (max 60 seconds)
    const duration = parseFloat(duration_seconds) || 0;
    if (duration > 60) {
      return NextResponse.json({ error: 'Durata massima 60 secondi' }, { status: 400 });
    }

    // Convert file to base64 for storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');

    // Save to database
    const { data, error } = await supabase
      .from('voice_notes')
      .insert({
        audio_blob: base64Audio,
        addetto_nome,
        cliente_riferimento: null,
        note_aggiuntive: note_aggiuntive || null,
        stato: 'pending',
        file_size: audioFile.size,
        duration_seconds: duration,
        cliente_id: null,
        busta_id: null
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore salvataggio database' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      noteId: data.id,
      message: 'Nota vocale salvata con successo' 
    });

  } catch (error) {
    console.error('Voice note save error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'processing' | 'completed' | 'failed' | null;

    // Delete COMPLETED notes older than 1 week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    await supabase
      .from('voice_notes')
      .delete()
      .eq('stato', 'completed')
      .lt('created_at', oneWeekAgo.toISOString());

    // Build query with related data
    let query = supabase
      .from('voice_notes')
      .select(`
        *,
        clienti:cliente_id (
          id,
          nome,
          cognome
        ),
        buste:busta_id (
          id,
          readable_id,
          stato_attuale
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('stato', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Errore recupero note vocali' }, { status: 500 });
    }

    return NextResponse.json({ notes: data });

  } catch (error) {
    console.error('Voice notes fetch error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}