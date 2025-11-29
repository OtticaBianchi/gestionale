export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { apiRateLimit } from '@/lib/rate-limit';
import { logAuditChange } from '@/lib/audit/auditLog';

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

      const audit = await logAuditChange(
        {
          tableName: 'voice_notes',
          recordId: data.id,
          action: 'INSERT',
          userId: null,
          changedFields: {
            _created: {
              old: null,
              new: {
                stato: data.stato,
                addetto_nome: data.addetto_nome,
                cliente_id: data.cliente_id,
                busta_id: data.busta_id,
                source: 'telegram_bot'
              }
            }
          },
          reason: 'Nota vocale creata via Telegram',
          metadata: {
            source: 'telegram_bot',
            telegram_message_id: jsonData.telegram_message_id ?? null,
            telegram_user_id: jsonData.telegram_user_id ?? null
          }
        },
        { logToConsole: false }
      );

      if (!audit.success) {
        console.error('AUDIT_INSERT_VOICE_NOTE_FAILED', audit.error);
      }

      return NextResponse.json({ 
        success: true, 
        noteId: data.id,
        message: 'Nota Telegram salvata con successo' 
      });
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
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'processing' | 'completed' | 'failed' | null;
    const summary = searchParams.get('summary');
    
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
    const role = profile?.role;
    const canManage = role === 'admin' || role === 'manager';

    if (!canManage && summary !== 'count') {
      return NextResponse.json({ error: 'Solo amministratori o manager possono accedere alle note vocali' }, { status: 403 });
    }

    // Maintenance cleanup (admin only): auto-dismiss and clean audio after 7 days
    if (role === 'admin') {
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
    if (summary === 'count') {
      let countQuery = supabase
        .from('voice_notes')
        .select('id', { count: 'exact', head: true })
        .is('dismissed_at', null);

      if (status) {
        countQuery = countQuery.eq('stato', status);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Voice notes count error:', countError);
        return NextResponse.json({ error: 'Errore conteggio note vocali' }, { status: 500 });
      }

      return NextResponse.json({ count: count ?? 0 });
    }

    let query;
    if (canManage) {
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
