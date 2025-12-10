export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ===== UTILITY FUNCTION FOR NAME CAPITALIZATION =====
const capitalizeNameProperly = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Split by spaces, filter empty strings, and capitalize each word
  return trimmed
    .split(' ')
    .filter(word => word.length > 0) // Remove empty strings from multiple spaces
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// GET - Fetch single client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;

    const { data: cliente, error } = await serverClient
      .from('clienti')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cliente) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    }

    return NextResponse.json({ success: true, cliente });
  } catch (error: any) {
    console.error('GET /api/clienti/[id] error:', error);
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 });
  }
}

// PATCH - Update client
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Check role
    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Solo admin e manager possono modificare i clienti' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Use service role client for update
    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    if (body.nome !== undefined) updateData.nome = capitalizeNameProperly(body.nome);
    if (body.cognome !== undefined) updateData.cognome = capitalizeNameProperly(body.cognome);
    if (body.genere !== undefined) updateData.genere = body.genere || null;
    if (body.telefono !== undefined) updateData.telefono = body.telefono.trim() || null;
    if (body.email !== undefined) updateData.email = body.email.trim() || null;
    if (body.data_nascita !== undefined) updateData.data_nascita = body.data_nascita || null;
    if (body.note_cliente !== undefined) updateData.note_cliente = body.note_cliente.trim() || null;

    const { data: updated, error } = await admin
      .from('clienti')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Errore durante l\'aggiornamento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, cliente: updated });
  } catch (error: any) {
    console.error('PATCH /api/clienti/[id] error:', error);
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 });
  }
}

// DELETE - Delete client (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Check role - only admin can delete
    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli admin possono eliminare clienti' }, { status: 403 });
    }

    const { id } = await params;

    // Use service role client for deletion
    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Check if client has associated buste
    const { data: buste, error: busteError } = await admin
      .from('buste')
      .select('id')
      .eq('cliente_id', id)
      .limit(1);

    if (busteError) {
      return NextResponse.json({ error: 'Errore durante la verifica delle buste' }, { status: 500 });
    }

    if (buste && buste.length > 0) {
      return NextResponse.json({
        error: 'Impossibile eliminare: il cliente ha buste associate. Elimina prima le buste.'
      }, { status: 400 });
    }

    const { error } = await admin
      .from('clienti')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message || 'Errore durante l\'eliminazione' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cliente eliminato con successo' });
  } catch (error: any) {
    console.error('DELETE /api/clienti/[id] error:', error);
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 });
  }
}
