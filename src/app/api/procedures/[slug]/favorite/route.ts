export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// POST - Toggle procedure favorite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { slug } = await params

    // Use service role for operations
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure ID from slug
    const { data: procedure } = await adminClient
      .from('procedures')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!procedure) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    // Check if already favorited
    const { data: existingFavorite } = await adminClient
      .from('procedure_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('procedure_id', procedure.id)
      .single()

    let action = ''
    if (existingFavorite) {
      // Remove from favorites
      const { error: deleteError } = await adminClient
        .from('procedure_favorites')
        .delete()
        .eq('id', existingFavorite.id)

      if (deleteError) {
        return NextResponse.json({ error: 'Errore rimozione preferito' }, { status: 500 })
      }
      action = 'removed'
    } else {
      // Add to favorites
      const { error: insertError } = await adminClient
        .from('procedure_favorites')
        .insert({
          user_id: user.id,
          procedure_id: procedure.id
        })

      if (insertError) {
        return NextResponse.json({ error: 'Errore aggiunta preferito' }, { status: 500 })
      }
      action = 'added'
    }

    return NextResponse.json({
      success: true,
      action,
      is_favorited: action === 'added'
    })

  } catch (error) {
    console.error('Error in POST /api/procedures/[slug]/favorite:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}