export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (rateLimitResult) return rateLimitResult;
  
  try {
    // Use service role client for anonymous inserts to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const contentType = request.headers.get('content-type');
    
    // ===== TELEGRAM BOT JSON REQUEST =====
    if (contentType?.includes('application/json')) {
      const jsonData = await request.json();
      
      // Validate required fields for Telegram bot
      if (!jsonData.audioBase64) {
        return NextResponse.json({ error: 'Audio data mancante' }, { status: 400 });
      }
      
      // Save Telegram bot data directly
      const { data, error } = await supabase
        .from('voice_notes')
        .insert({
          audio_blob: jsonData.audioBase64,
          addetto_nome: jsonData.addetto_nome || 'Telegram Bot',
          cliente_riferimento: jsonData.cliente_riferimento || null,
          note_aggiuntive: jsonData.transcription || null,
          stato: 'pending',
          file_size: jsonData.file_size || 0,
          duration_seconds: jsonData.duration_seconds || 0,
          cliente_id: jsonData.cliente_id || null,
          busta_id: jsonData.busta_id || null,
          
          // Telegram-specific fields
          telegram_message_id: jsonData.telegram_message_id || null,
          telegram_user_id: jsonData.telegram_user_id || null,
          telegram_username: jsonData.telegram_username || null,
          audio_file_path: jsonData.audio_file_path || null,
          
          // AI Analysis fields
          category_auto: jsonData.category_auto || null,
          sentiment: jsonData.sentiment || null,
          priority_level: jsonData.priority_level || 2,
          extracted_dates: jsonData.extracted_dates || null,
          confidence_scores: jsonData.confidence_scores || null,
          needs_review: jsonData.needs_review || false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Telegram bot database error:', error);
        return NextResponse.json({ 
          error: 'Errore salvataggio database', 
          details: error.message 
        }, { status: 500 });
      }
      
      // Note: Transcription now handled by webhook route, not here

      return NextResponse.json({ 
        success: true, 
        noteId: data.id,
        message: 'Nota Telegram salvata con successo' 
      });
    }
    
    // ===== LEGACY PWA FORMDATA REQUEST (DEPRECATED) =====
    else if (contentType?.includes('multipart/form-data')) {
      return NextResponse.json({ 
        error: 'PWA interface deprecated - use Telegram bot', 
        telegram_bot: '@your_bot_username'
      }, { status: 410 });
    }
    
    else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

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
    
    // Require auth and determine role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.role === 'admin';

    // Maintenance cleanup (admin only): auto-dismiss and clean audio after 7 days
    if (isAdmin) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Auto-dismiss completed notes after 7 days (same as manual deletion)
      // Only dismiss notes that user has manually marked as completed
      await supabase
        .from('voice_notes')
        .update({ 
          dismissed_at: new Date().toISOString(),
          audio_blob: '', 
          file_size: 0 
        })
        .eq('stato', 'completed') // Only auto-dismiss manually completed notes
        .lt('updated_at', oneWeekAgo.toISOString()) // Use updated_at since that's when user marked it completed
        .is('dismissed_at', null); // Only auto-dismiss if not already dismissed
    }

    // Build query with related data - only show non-dismissed notes
    let query
    if (isAdmin) {
      // Admin sees everything including audio_blob
      query = supabase
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
        .is('dismissed_at', null) // Only show active (non-dismissed) notes
        .order('created_at', { ascending: false });
    } else {
      // Non-admin: hide audio_blob and other sensitive fields
      query = supabase
        .from('voice_notes')
        .select(`
          id,
          addetto_nome,
          cliente_riferimento,
          note_aggiuntive,
          transcription,
          stato,
          file_size,
          duration_seconds,
          created_at,
          updated_at,
          cliente_id,
          busta_id,
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
        .is('dismissed_at', null) // Only show active (non-dismissed) notes
        .order('created_at', { ascending: false });
    }

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
