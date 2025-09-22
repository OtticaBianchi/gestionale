export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { sourceId, includeItems } = await request.json();

    // Get current user for creato_da field
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!sourceId) {
      return NextResponse.json({ error: 'ID busta sorgente richiesto' }, { status: 400 });
    }

    console.log(`🔄 Duplicating busta ${sourceId}, includeItems: ${includeItems}`);

    // Get the source busta with all related data
    const { data: sourceBusta, error: bustaError } = await supabase
      .from('buste')
      .select(`
        *
      `)
      .eq('id', sourceId)
      .single();

    if (bustaError || !sourceBusta) {
      console.error('❌ Error fetching source busta:', {
        error: bustaError,
        sourceId,
        found: !!sourceBusta
      });
      return NextResponse.json({ error: 'Busta sorgente non trovata' }, { status: 404 });
    }

    console.log('📋 Source busta found:', {
      id: sourceBusta.id,
      readable_id: sourceBusta.readable_id,
      cliente_id: sourceBusta.cliente_id,
      tipo_lavorazione: sourceBusta.tipo_lavorazione,
      priorita: sourceBusta.priorita
    });

    // Create new busta with minimal required data (matching BustaForm pattern)
    const newBustaData = {
      cliente_id: sourceBusta.cliente_id,
      tipo_lavorazione: sourceBusta.tipo_lavorazione || null,
      priorita: sourceBusta.priorita || 'normale',
      note_generali: `Duplicata da ${sourceBusta.readable_id}`,
      creato_da: user.id
    };

    console.log('🆕 Attempting to create new busta with data:', newBustaData);

    const { data: newBusta, error: createError } = await supabase
      .from('buste')
      .insert(newBustaData)
      .select()
      .single();

    if (createError || !newBusta) {
      console.error('❌ Error creating new busta:', {
        error: createError,
        code: createError?.code,
        message: createError?.message,
        details: createError?.details,
        hint: createError?.hint,
        newBustaData
      });
      return NextResponse.json({ 
        error: 'Errore nella creazione della nuova busta', 
        details: createError?.message,
        code: createError?.code 
      }, { status: 500 });
    }

    console.log(`✅ Created new busta: ${newBusta.readable_id}`);

    // If includeItems is true, copy materiali
    if (includeItems) {
      console.log('📋 Copying materiali from source busta...');
      
      const { data: sourceMateriali, error: materialiError } = await supabase
        .from('ordini_materiali')
        .select('*')
        .eq('busta_id', sourceId);

      if (!materialiError && sourceMateriali && sourceMateriali.length > 0) {
        const newMateriali = sourceMateriali.map(materiale => ({
          busta_id: newBusta.id,
          descrizione_prodotto: materiale.descrizione_prodotto,
          data_consegna_prevista: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
          stato: 'da_ordinare' as const,
          da_ordinare: true,
          note: `Copiato da ${sourceBusta.readable_id}`
        }));

        const { error: insertMatError } = await supabase
          .from('ordini_materiali')
          .insert(newMateriali);

        if (insertMatError) {
          console.error('Error copying materiali:', insertMatError);
          // Don't fail the whole operation, just log the error
        } else {
          console.log(`✅ Copied ${newMateriali.length} materiali`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      newBustaId: newBusta.id,
      newReadableId: newBusta.readable_id || newBusta.id,
      message: `Busta duplicata con successo` 
    });

  } catch (error) {
    console.error('Busta duplication error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}