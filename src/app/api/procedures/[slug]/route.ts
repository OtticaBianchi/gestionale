export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - Get single procedure by slug
export async function GET(
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

    // Use service role for query
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure with related data
    const { data: procedure, error } = await adminClient
      .from('procedures')
      .select(`
        *,
        created_by_profile:profiles!procedures_created_by_fkey(full_name),
        updated_by_profile:profiles!procedures_updated_by_fkey(full_name),
        last_reviewed_by_profile:profiles!procedures_last_reviewed_by_fkey(full_name),
        related_procedures:procedure_dependencies!procedure_dependencies_procedure_id_fkey(
          depends_on_id,
          relationship_type,
          related_procedure:procedures!procedure_dependencies_depends_on_id_fkey(
            id, title, slug, context_category
          )
        ),
        dependent_procedures:procedure_dependencies!procedure_dependencies_depends_on_id_fkey(
          procedure_id,
          relationship_type,
          dependent_procedure:procedures!procedure_dependencies_procedure_id_fkey(
            id, title, slug, context_category
          )
        )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !procedure) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    // Check if user has favorited this procedure
    const { data: favorite } = await adminClient
      .from('procedure_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('procedure_id', procedure.id)
      .single()

    procedure.is_favorited = !!favorite

    // Increment view count and log access
    await adminClient.rpc('increment_procedure_view_count', {
      procedure_uuid: procedure.id,
      user_uuid: user.id
    })

    return NextResponse.json({
      success: true,
      data: procedure
    })

  } catch (error) {
    console.error('Error in GET /api/procedures/[slug]:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// PUT - Update procedure (admin only)
export async function PUT(
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

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono modificare procedure' }, { status: 403 })
    }

    const { slug } = await params
    const body = await request.json()

    // Use service role for operations
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if procedure exists
    const { data: existing } = await adminClient
      .from('procedures')
      .select('id, title')
      .eq('slug', slug)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    // Generate new slug if title changed
    let newSlug = slug
    if (body.title && body.title !== existing.title) {
      newSlug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()
    }

    // Only include fields that should be updated (exclude read-only and relation fields)
    const updateData: any = {
      slug: newSlug,
      updated_by: user.id,
      last_reviewed_at: new Date().toISOString().split('T')[0],
      last_reviewed_by: user.id
    }

    // Add only the fields that are allowed to be updated
    const allowedFields = [
      'title',
      'description',
      'content',
      'context_category',
      'procedure_type',
      'target_roles',
      'search_tags',
      'is_featured',
      'mini_help_title',
      'mini_help_summary',
      'mini_help_action'
    ]

    allowedFields.forEach(field => {
      if (field in body) {
        updateData[field] = body[field]
      }
    })

    const { data: updatedProcedure, error: updateError } = await adminClient
      .from('procedures')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating procedure:', updateError)
      return NextResponse.json({
        error: 'Errore aggiornamento procedura',
        details: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedProcedure,
      message: 'Procedura aggiornata con successo'
    })

  } catch (error) {
    console.error('Error in PUT /api/procedures/[slug]:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// DELETE - Delete procedure (admin only)
export async function DELETE(
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

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono eliminare procedure' }, { status: 403 })
    }

    const { slug } = await params

    // Use service role for operations
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Soft delete by setting is_active to false
    const { error: deleteError } = await adminClient
      .from('procedures')
      .update({
        is_active: false,
        updated_by: user.id
      })
      .eq('slug', slug)

    if (deleteError) {
      console.error('Error deleting procedure:', deleteError)
      return NextResponse.json({ error: 'Errore eliminazione procedura' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Procedura eliminata con successo'
    })

  } catch (error) {
    console.error('Error in DELETE /api/procedures/[slug]:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}