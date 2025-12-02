/**
 * FU2.0 - Create Error from Follow-Up
 *
 * POST /api/follow-up/calls/[id]/errore
 *
 * Creates an error record from a follow-up call with low satisfaction.
 * Pre-populates ET2.0 fields and marks both follow-up and error records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { logInsert, logUpdate } from '@/lib/audit/auditLog';
import { calculateImpattoCliente } from '@/lib/fu2/categorizeCustomer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id: followUpId } = await params;

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Role check - solo operatori che hanno accesso a follow-up
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const {
      error_type,
      error_category,
      error_description,
      operatore_coinvolto,
      procedura_flag = 'procedura_presente', // Default as per PRD
      impatto_cliente, // Optional override
    } = body;

    // Validate required fields
    if (!error_type || !error_category || !error_description) {
      return NextResponse.json(
        {
          error:
            'Campi obbligatori mancanti: error_type, error_category, error_description',
        },
        { status: 400 }
      );
    }

    // Use service role for complex queries
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch follow-up call data with busta and cliente info
    const { data: followUp, error: fetchError } = await adminClient
      .from('follow_up_chiamate')
      .select(
        `
        id,
        busta_id,
        livello_soddisfazione,
        note_chiamata,
        crea_errore,
        busta:buste (
          id,
          readable_id,
          cliente_id,
          clienti:clienti (
            id,
            nome,
            cognome
          )
        )
      `
      )
      .eq('id', followUpId)
      .single();

    if (fetchError || !followUp) {
      console.error('Follow-up not found:', fetchError);
      return NextResponse.json(
        { error: 'Chiamata follow-up non trovata' },
        { status: 404 }
      );
    }

    // Check if error already created for this follow-up
    if (followUp.crea_errore) {
      return NextResponse.json(
        { error: 'Errore già creato per questa chiamata follow-up' },
        { status: 400 }
      );
    }

    // Get busta total value for impatto calculation
    const { data: infoPagamenti } = await adminClient
      .from('info_pagamenti')
      .select('totale')
      .eq('busta_id', followUp.busta_id)
      .single();

    const ticketValue = infoPagamenti?.totale || 0;

    // Calculate impatto_cliente if not provided
    const finalImpatto =
      impatto_cliente || calculateImpattoCliente(ticketValue);

    // Extract cliente_id from nested structure
    const cliente = (followUp.busta as any)?.clienti;
    const cliente_id = cliente?.id || (followUp.busta as any)?.cliente_id;

    // Create error via error-tracking API logic (reuse existing cost calculation)
    // We'll call the error-tracking API internally
    const errorPayload = {
      busta_id: followUp.busta_id,
      employee_id: operatore_coinvolto || user.id, // Fallback to current user
      cliente_id,
      error_type,
      error_category,
      error_description,
      cost_type: 'estimate',
      client_impacted: true, // Always true for follow-up generated errors
      time_lost_minutes: 0,
      requires_reorder: false,
      is_draft: false,
      // ET2.0 fields - prepopulated as per PRD Section 3.3
      step_workflow: 'follow_up',
      intercettato_da: 'ob_follow_up',
      procedura_flag,
      impatto_cliente: finalImpatto,
      operatore_coinvolto,
      creato_da_followup: true,
    };

    // Insert error directly with admin client
    const { data: newError, error: errorInsertError } = await adminClient
      .from('error_tracking')
      .insert(errorPayload)
      .select(
        `
        id,
        error_type,
        error_category,
        error_description,
        cost_amount,
        step_workflow,
        assegnazione_colpa,
        reported_at
      `
      )
      .single();

    if (errorInsertError || !newError) {
      console.error('Error creating error record:', errorInsertError);
      return NextResponse.json(
        { error: 'Errore durante la creazione dell\'errore' },
        { status: 500 }
      );
    }

    // Update follow-up to mark error creation
    const { error: updateError } = await adminClient
      .from('follow_up_chiamate')
      .update({
        crea_errore: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', followUpId);

    if (updateError) {
      console.error('Failed to update follow-up crea_errore flag:', updateError);
      // Don't fail the request - error was created successfully
    }

    // Audit log for error creation
    await logInsert(
      'error_tracking',
      newError.id,
      user.id,
      {
        error_type: newError.error_type,
        error_category: newError.error_category,
        step_workflow: 'follow_up',
        creato_da_followup: true,
      },
      `Errore creato da follow-up (${followUpId})`,
      {
        source: 'api/follow-up/calls/[id]/errore',
        follow_up_id: followUpId,
        satisfaction: followUp.livello_soddisfazione,
      },
      profile.role
    );

    // Audit log for follow-up update
    await logUpdate(
      'follow_up_chiamate',
      followUpId,
      user.id,
      { crea_errore: false },
      { crea_errore: true },
      'Follow-up marcato con errore creato',
      {
        source: 'api/follow-up/calls/[id]/errore',
        error_id: newError.id,
      },
      profile.role
    );

    console.log(
      `✅ FU2.0: Error ${newError.id} created from follow-up ${followUpId}`
    );

    return NextResponse.json({
      success: true,
      data: {
        error: newError,
        follow_up_id: followUpId,
      },
      message: 'Errore creato con successo da follow-up',
    });
  } catch (error) {
    console.error('Error in POST /api/follow-up/calls/[id]/errore:', error);
    return NextResponse.json(
      { error: 'Errore interno server' },
      { status: 500 }
    );
  }
}
