// API Route: Global Notes Search
// Searches through all notes across buste (active + archived)

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use service role for broader access
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get search query
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: 'Query troppo corta. Minimo 2 caratteri.'
      });
    }

    const results: any[] = [];
    const searchPattern = `%${query}%`;

    // 1. Search in buste.note_generali
    const busteNotesQuery = supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        note_generali,
        stato_attuale,
        data_apertura,
        clienti (
          id,
          nome,
          cognome
        )
      `)
      .ilike('note_generali', searchPattern)
      .not('note_generali', 'is', null);

    if (!includeArchived) {
      busteNotesQuery.neq('stato_attuale', 'consegnato_pagato');
    }

    const { data: busteNotes, error: busteError } = await busteNotesQuery.limit(20);

    if (!busteError && busteNotes) {
      busteNotes.forEach((busta) => {
        results.push({
          type: 'note',
          source: 'Note Generali',
          sourceIcon: 'file',
          note: busta.note_generali,
          busta: {
            id: busta.id,
            readable_id: busta.readable_id,
            stato_attuale: busta.stato_attuale,
            data_apertura: busta.data_apertura,
            isArchived: busta.stato_attuale === 'consegnato_pagato'
          },
          cliente: busta.clienti ? {
            id: busta.clienti.id,
            nome: busta.clienti.nome,
            cognome: busta.clienti.cognome
          } : null
        });
      });
    }

    // 2. Search in buste.note_spedizione
    const spedizioneNotesQuery = supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        note_spedizione,
        stato_attuale,
        data_apertura,
        clienti (
          id,
          nome,
          cognome
        )
      `)
      .ilike('note_spedizione', searchPattern)
      .not('note_spedizione', 'is', null);

    if (!includeArchived) {
      spedizioneNotesQuery.neq('stato_attuale', 'consegnato_pagato');
    }

    const { data: spedizioneNotes, error: spedError } = await spedizioneNotesQuery.limit(20);

    if (!spedError && spedizioneNotes) {
      spedizioneNotes.forEach((busta) => {
        results.push({
          type: 'note',
          source: 'Note Spedizione',
          sourceIcon: 'ship',
          note: busta.note_spedizione,
          busta: {
            id: busta.id,
            readable_id: busta.readable_id,
            stato_attuale: busta.stato_attuale,
            data_apertura: busta.data_apertura,
            isArchived: busta.stato_attuale === 'consegnato_pagato'
          },
          cliente: busta.clienti ? {
            id: busta.clienti.id,
            nome: busta.clienti.nome,
            cognome: busta.clienti.cognome
          } : null
        });
      });
    }

    // 3. Search in ordini_materiali.note
    const ordiniNotesQuery = supabase
      .from('ordini_materiali')
      .select(`
        id,
        note,
        descrizione_prodotto,
        created_at,
        busta_id,
        buste!inner (
          id,
          readable_id,
          stato_attuale,
          data_apertura,
          clienti (
            id,
            nome,
            cognome
          )
        )
      `)
      .ilike('note', searchPattern)
      .not('note', 'is', null);

    if (!includeArchived) {
      ordiniNotesQuery.neq('buste.stato_attuale', 'consegnato_pagato');
    }

    const { data: ordiniNotes, error: ordiniError } = await ordiniNotesQuery.limit(20);

    if (!ordiniError && ordiniNotes) {
      ordiniNotes.forEach((ordine: any) => {
        results.push({
          type: 'note',
          source: 'Ordini Materiali',
          sourceIcon: 'package',
          note: ordine.note,
          metadata: ordine.descrizione_prodotto,
          busta: {
            id: ordine.buste.id,
            readable_id: ordine.buste.readable_id,
            stato_attuale: ordine.buste.stato_attuale,
            data_apertura: ordine.buste.data_apertura,
            isArchived: ordine.buste.stato_attuale === 'consegnato_pagato'
          },
          cliente: ordine.buste.clienti ? {
            id: ordine.buste.clienti.id,
            nome: ordine.buste.clienti.nome,
            cognome: ordine.buste.clienti.cognome
          } : null
        });
      });
    }

    // 4. Search in lavorazioni.note
    const lavorazioniNotesQuery = supabase
      .from('lavorazioni')
      .select(`
        id,
        note,
        tentativo,
        created_at,
        busta_id,
        buste!inner (
          id,
          readable_id,
          stato_attuale,
          data_apertura,
          clienti (
            id,
            nome,
            cognome
          )
        )
      `)
      .ilike('note', searchPattern)
      .not('note', 'is', null);

    if (!includeArchived) {
      lavorazioniNotesQuery.neq('buste.stato_attuale', 'consegnato_pagato');
    }

    const { data: lavorazioniNotes, error: lavError } = await lavorazioniNotesQuery.limit(20);

    if (!lavError && lavorazioniNotes) {
      lavorazioniNotes.forEach((lav: any) => {
        results.push({
          type: 'note',
          source: 'Lavorazioni',
          sourceIcon: 'wrench',
          note: lav.note,
          metadata: `Tentativo #${lav.tentativo}`,
          busta: {
            id: lav.buste.id,
            readable_id: lav.buste.readable_id,
            stato_attuale: lav.buste.stato_attuale,
            data_apertura: lav.buste.data_apertura,
            isArchived: lav.buste.stato_attuale === 'consegnato_pagato'
          },
          cliente: lav.buste.clienti ? {
            id: lav.buste.clienti.id,
            nome: lav.buste.clienti.nome,
            cognome: lav.buste.clienti.cognome
          } : null
        });
      });
    }

    // Sort by date (most recent first)
    results.sort((a, b) => {
      const dateA = new Date(a.busta.data_apertura).getTime();
      const dateB = new Date(b.busta.data_apertura).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      results: results.slice(0, 50), // Limit to 50 total results
      total: results.length,
      query
    });

  } catch (error: any) {
    console.error('Error in notes search:', error);
    return NextResponse.json(
      { error: 'Errore durante la ricerca delle note', details: error.message },
      { status: 500 }
    );
  }
}
