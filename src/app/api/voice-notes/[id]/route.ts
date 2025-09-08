export const dynamic = 'force-dynamic' 
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

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
    
    const { transcription, stato, processed_by } = body;

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

    return NextResponse.json({ 
      success: true, 
      note: data,
      message: 'Nota vocale aggiornata con successo' 
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
    const supabase = createServerSupabaseClient();
    const { id } = params;

    // Check user role - only admin can delete voice notes
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Solo gli amministratori possono eliminare le note vocali' 
      }, { status: 403 });
    }

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
