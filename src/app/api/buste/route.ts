export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { logInsert } from '@/lib/audit/auditLog'
import {
  PLACEHOLDER_PHONE,
  normalizePhone,
  isShopPhone,
  isOtticaBianchiName
} from '@/lib/clients/phoneRules'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase credentials for buste API')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

const VALID_WORK_TYPES = [
  'OCV', 'OV', 'OS', 'LV', 'LS', 'LAC', 'TALAC', 'ACC', 'RIC', 'LAB',
  'SA', 'SG', 'CT', 'BR', 'ES', 'REL', 'FT', 'SPRT', 'VFT'
]

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
    }

    const clienteInput = body.cliente
    const bustaInput = body.busta

    if (!clienteInput || !bustaInput) {
      return NextResponse.json({ error: 'Dati cliente o busta mancanti' }, { status: 400 })
    }

    // ✅ GESTIONE ANNO PRECEDENTE
    const annoPrecedente = bustaInput.anno_precedente === true

    if (!clienteInput.nome?.trim() || !clienteInput.cognome?.trim()) {
      return NextResponse.json({ error: 'Nome e cognome cliente sono obbligatori' }, { status: 400 })
    }

    const priorita = bustaInput.priorita || 'normale'
    const allowedPriorita = ['normale', 'urgente', 'critica']
    if (!allowedPriorita.includes(priorita)) {
      return NextResponse.json({ error: 'Priorità non valida' }, { status: 400 })
    }

    const tipoLavorazioneRaw: string | null = bustaInput.tipo_lavorazione || null
    const tipoLavorazione = tipoLavorazioneRaw && VALID_WORK_TYPES.includes(tipoLavorazioneRaw)
      ? (tipoLavorazioneRaw as Database['public']['Enums']['work_type'])
      : null

    const normalizedPhone = normalizePhone(clienteInput.telefono)
    if (!normalizedPhone) {
      return NextResponse.json({ error: `Telefono obbligatorio (usa ${PLACEHOLDER_PHONE} se non disponibile)` }, { status: 400 })
    }

    let clienteId: string | null = clienteInput.id || null

    const isShopPhoneNumber = isShopPhone(normalizedPhone)
    const isOtticaBianchi = isOtticaBianchiName(clienteInput.nome, clienteInput.cognome)

    if (isShopPhoneNumber && !isOtticaBianchi && !clienteId) {
      return NextResponse.json({ error: 'Numero negozio consentito solo per Ottica Bianchi' }, { status: 400 })
    }

    if (!clienteId) {
      // ✅ NEW LOGIC: Only auto-match when BOTH phone AND name match
      // This prevents auto-selecting the wrong person when phone is shared (caregiver/family scenarios)

      let existingClient = null

      // First, try to match by name (most reliable identifier)
      const { data: byName } = await admin
        .from('clienti')
        .select('id, telefono')
        .eq('cognome', capitalizeNameProperly(clienteInput.cognome))
        .eq('nome', capitalizeNameProperly(clienteInput.nome))
        .maybeSingle()

      if (byName) {
        existingClient = byName
      }

      // If we found a match by name, verify phone compatibility
      if (existingClient) {
        // If names match and phones match (or existing has no phone), reuse client
        if (!existingClient.telefono || existingClient.telefono === normalizedPhone) {
          clienteId = existingClient.id
        } else if (normalizedPhone) {
          // Names match but phones differ - this is a data conflict
          // For now, create new client (operator should merge manually if needed)
          existingClient = null
        } else {
          // No phone provided, name matches - reuse client
          clienteId = existingClient.id
        }
      }

      // ❌ REMOVED: Automatic phone-only matching
      // We no longer auto-select clients based on phone alone
      // This was causing the bug where "Anna Rossi" would be created as "Mario Rossi"
      // when they share a phone number (caregiver/family scenarios)
    }

    let clienteRecord = null

    if (!clienteId) {
      if (isShopPhoneNumber && isOtticaBianchi) {
        return NextResponse.json({ error: 'Cliente Ottica Bianchi già presente: selezionalo dalla ricerca' }, { status: 400 })
      }
      const { data: insertedClient, error: insertClienteError } = await admin
        .from('clienti')
        .insert({
          cognome: capitalizeNameProperly(clienteInput.cognome),
          nome: capitalizeNameProperly(clienteInput.nome),
          telefono: normalizedPhone,
          email: clienteInput.email?.trim() || null,
          genere: clienteInput.genere || null,
          note_cliente: clienteInput.note_cliente?.trim() || null,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single()

      if (insertClienteError || !insertedClient) {
        console.error('Errore creazione cliente:', insertClienteError)
        return NextResponse.json({ error: 'Errore creazione cliente' }, { status: 500 })
      }

      clienteRecord = insertedClient
      clienteId = insertedClient.id

      await logInsert(
        'clienti',
        clienteId!,
        user.id,
        {
          nome: insertedClient.nome,
          cognome: insertedClient.cognome,
          telefono: insertedClient.telefono
        },
        'Creazione cliente da nuova busta',
        { source: 'api/buste POST' },
        userRole
      )
    } else {
      // Cliente esistente - fetch i dati esistenti senza modificarli
      // ✅ NON aggiorniamo più automaticamente i dati del cliente esistente
      // Questo previene la sovrascrittura accidentale di dati quando si seleziona
      // un cliente esistente dalla ricerca manuale
      const { data: existing } = await admin
        .from('clienti')
        .select('*')
        .eq('id', clienteId)
        .maybeSingle()

      clienteRecord = existing
      if (existing) {
        const existingIsOtticaBianchi = isOtticaBianchiName(existing.nome, existing.cognome)
        if (isShopPhoneNumber && !existingIsOtticaBianchi) {
          return NextResponse.json({ error: 'Numero negozio consentito solo per Ottica Bianchi' }, { status: 400 })
        }
      }

      if (existing) {
        const updates: Record<string, any> = {}
        const normalizedEmail = clienteInput.email?.trim() || null

        if (normalizedPhone && (!existing.telefono || existing.telefono.trim() === '')) {
          updates.telefono = normalizedPhone
        }
        if (normalizedEmail && (!existing.email || existing.email.trim() === '')) {
          updates.email = normalizedEmail
        }
        if (clienteInput.genere && !existing.genere) {
          updates.genere = clienteInput.genere
        }
        if (clienteInput.note_cliente?.trim() && (!existing.note_cliente || existing.note_cliente.trim() === '')) {
          updates.note_cliente = clienteInput.note_cliente.trim()
        }

        if (Object.keys(updates).length > 0) {
          const { data: updatedClient, error: updateError } = await admin
            .from('clienti')
            .update({
              ...updates,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', clienteId)
            .select('*')
            .single()

          if (updateError || !updatedClient) {
            console.error('Errore aggiornamento cliente esistente:', updateError)
            return NextResponse.json({ error: 'Errore aggiornamento cliente' }, { status: 500 })
          }

          clienteRecord = updatedClient
        }
      }
    }

    // ✅ CALCOLA IL PREFISSO ANNO PER IL NUMERO BUSTA
    const currentYear = new Date().getFullYear()
    const targetYear = annoPrecedente ? currentYear - 1 : currentYear
    const yearSuffix = targetYear.toString().slice(-2) // Ultimi 2 caratteri (es. "25" o "26")

    // ✅ TROVA IL PROSSIMO NUMERO PROGRESSIVO PER L'ANNO SELEZIONATO
    const { data: existingBuste } = await admin
      .from('buste')
      .select('readable_id')
      .like('readable_id', `${yearSuffix}-%`)
      .order('readable_id', { ascending: false })
      .limit(1)

    let nextProgressive = 1
    if (existingBuste && existingBuste.length > 0) {
      const lastId = existingBuste[0].readable_id
      if (lastId) {
        const match = lastId.match(/^\d{2}-(\d{4})$/)
        if (match) {
          nextProgressive = parseInt(match[1], 10) + 1
        }
      }
    }

    const customReadableId = `${yearSuffix}-${nextProgressive.toString().padStart(4, '0')}`

    const now = new Date().toISOString()
    const { data: newBusta, error: bustaError } = await admin
      .from('buste')
      .insert({
        cliente_id: clienteId,
        tipo_lavorazione: tipoLavorazione,
        priorita,
        note_generali: bustaInput.note_generali?.trim() || null,
        stato_attuale: bustaInput.stato_attuale || 'nuove',
        creato_da: user.id,
        updated_by: user.id,
        readable_id: customReadableId  // ✅ SETTA IL READABLE_ID MANUALMENTE
      })
      .select('*')
      .single()

    if (bustaError || !newBusta) {
      console.error('Errore creazione busta:', bustaError)
      return NextResponse.json({
        error: bustaError?.message || 'Errore creazione busta',
        details: bustaError?.details || bustaError?.hint || null
      }, { status: 500 })
    }

    await logInsert(
      'buste',
      newBusta.id,
      user.id,
      {
        cliente_id: newBusta.cliente_id,
        priorita: newBusta.priorita,
        tipo_lavorazione: newBusta.tipo_lavorazione,
        stato_attuale: newBusta.stato_attuale
      },
      'Creazione busta',
      { readable_id: newBusta.readable_id },
      userRole
    )

    const statusInsert = await admin
      .from('status_history')
      .insert({
        busta_id: newBusta.id,
        stato: newBusta.stato_attuale ?? 'nuove',
        data_ingresso: now,
        operatore_id: user.id,
        note_stato: 'Busta creata'
      })

    if (statusInsert.error) {
      console.error('Errore inserimento status_history:', statusInsert.error)
    }

    return NextResponse.json({
      success: true,
      busta: newBusta,
      cliente: clienteRecord
    })

  } catch (error: any) {
    console.error('POST /api/buste error:', error)
    return NextResponse.json({
      error: error?.message || 'Errore interno server'
    }, { status: 500 })
  }
}
