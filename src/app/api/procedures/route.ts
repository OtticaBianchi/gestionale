export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - List procedures with filters and search
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Get user profile for analytics
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
    }

    // Parse query parameters
    const search = searchParams.get('search') || ''
    const context_category = searchParams.get('context_category')
    const procedure_type = searchParams.get('procedure_type')
    const target_role = searchParams.get('target_role')
    const user_favorites = searchParams.get('favorites') === 'true'
    const recent_only = searchParams.get('recent') === 'true'

    // Use service role for queries after auth check
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Handle recently viewed procedures
    if (recent_only) {
      const { data: recentProcedures } = await adminClient
        .rpc('get_recently_viewed_procedures', {
          user_uuid: user.id,
          limit_count: 10
        })

      return NextResponse.json({
        success: true,
        data: recentProcedures || [],
        type: 'recent'
      })
    }

    // Base query
    let query = adminClient
      .from('procedures')
      .select(`
        id,
        title,
        slug,
        description,
        context_category,
        procedure_type,
        target_roles,
        search_tags,
        is_featured,
        view_count,
        mini_help_title,
        mini_help_summary,
        mini_help_action,
        last_reviewed_at,
        created_at,
        updated_at${user_favorites ? `,
        favorites:procedure_favorites!inner(
          user_id
        )` : ''}
      `)
      .eq('is_active', true)
      .order('last_reviewed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })

    // Apply filters
    if (context_category) {
      query = query.eq('context_category', context_category)
    }

    if (procedure_type) {
      query = query.eq('procedure_type', procedure_type)
    }

    if (target_role) {
      query = query.contains('target_roles', [target_role])
    }

    if (user_favorites) {
      query = query.eq('favorites.user_id', user.id)
    }

    // Apply search
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,search_tags.cs.{${search}}`)
    }

    const { data: procedures, error } = await query

    if (error) {
      console.error('Error fetching procedures:', error)
      return NextResponse.json({ error: 'Errore caricamento procedure' }, { status: 500 })
    }

    // Get user's favorites for each procedure
    if (!user_favorites && procedures) {
      const { data: userFavorites } = await adminClient
        .from('procedure_favorites')
        .select('procedure_id')
        .eq('user_id', user.id)

      const favoriteIds = new Set(userFavorites?.map(f => f.procedure_id) || [])

      procedures.forEach((proc: any) => {
        proc.is_favorited = favoriteIds.has(proc.id)
      })
    }

    return NextResponse.json({
      success: true,
      data: procedures || [],
      filters: {
        search,
        context_category,
        procedure_type,
        target_role,
        user_favorites
      }
    })

  } catch (error) {
    console.error('Error in GET /api/procedures:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// POST - Create new procedure (admin only)
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo admin possono creare procedure' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      content,
      context_category,
      procedure_type,
      target_roles,
      search_tags,
      is_featured,
      mini_help_title,
      mini_help_summary,
      mini_help_action
    } = body

    // Validate required fields
    if (!title || !content || !context_category || !procedure_type) {
      return NextResponse.json({
        error: 'Campi obbligatori: title, content, context_category, procedure_type'
      }, { status: 400 })
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim()

    // Use service role for insert
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: newProcedure, error: insertError } = await adminClient
      .from('procedures')
      .insert({
        title,
        slug,
        description,
        content,
        context_category,
        procedure_type,
        target_roles: target_roles || [],
        search_tags: search_tags || [],
        is_featured: is_featured || false,
        mini_help_title,
        mini_help_summary,
        mini_help_action,
        created_by: user.id,
        updated_by: user.id,
        last_reviewed_at: new Date().toISOString().split('T')[0],
        last_reviewed_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating procedure:', insertError)
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Una procedura con questo titolo esiste già' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Errore creazione procedura' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: newProcedure,
      message: 'Procedura creata con successo'
    })

  } catch (error) {
    console.error('Error in POST /api/procedures:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
