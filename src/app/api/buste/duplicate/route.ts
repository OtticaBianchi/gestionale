export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { sourceId, includeItems } = await request.json();

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
      console.error('Error fetching source busta:', bustaError);
      return NextResponse.json({ error: 'Busta sorgente non trovata' }, { status: 404 });
    }

    // Get the next readable_id
    const currentYear = new Date().getFullYear();
    const { data: lastBusta } = await supabase
      .from('buste')
      .select('readable_id')
      .like('readable_id', `B-${currentYear}-%`)
      .order('readable_id', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (lastBusta && lastBusta.length > 0 && lastBusta[0].readable_id) {
      const lastId = lastBusta[0].readable_id;
      const lastNumber = parseInt(lastId.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const newReadableId = `B-${currentYear}-${nextNumber.toString().padStart(3, '0')}`;

    // Create new busta with basic data (anagrafica fields will be copied manually later)
    const newBustaData = {
      readable_id: newReadableId,
      cliente_id: sourceBusta.cliente_id,
      stato_attuale: 'nuove' as const,
      stato_chiusura: null,
      data_apertura: new Date().toISOString(),
      data_consegna_prevista: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 days
      tipo_lavorazione: sourceBusta.tipo_lavorazione || 'OV',
      priorita: sourceBusta.priorita || 'normale',
      note_generali: `Duplicata da ${sourceBusta.readable_id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newBusta, error: createError } = await supabase
      .from('buste')
      .insert(newBustaData)
      .select()
      .single();

    if (createError || !newBusta) {
      console.error('Error creating new busta:', createError);
      return NextResponse.json({ error: 'Errore nella creazione della nuova busta' }, { status: 500 });
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
      newReadableId: newBusta.readable_id,
      message: `Busta ${newBusta.readable_id} creata con successo` 
    });

  } catch (error) {
    console.error('Busta duplication error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}