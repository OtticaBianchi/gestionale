export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    // Get all active procedures count
    const { count: totalProcedures } = await supabase
      .from('procedures')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Get all users with their roles
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true })

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Errore recupero utenti' }, { status: 500 })
    }

    // Get all active procedures for reference
    const { data: allProcedures, error: proceduresError } = await supabase
      .from('procedures')
      .select('id, title, slug, is_active')
      .eq('is_active', true)

    if (proceduresError) {
      console.error('Error fetching procedures:', proceduresError)
      return NextResponse.json({ error: 'Errore recupero procedure' }, { status: 500 })
    }

    // Create a map for quick lookup
    const procedureMap = new Map(allProcedures?.map(p => [p.id, p]) || [])

    // Get all procedure read receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('procedure_read_receipts')
      .select('user_id, procedure_id, acknowledged_at')

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError)
      return NextResponse.json({ error: 'Errore recupero letture' }, { status: 500 })
    }

    // Build user compliance data
    const userCompliance = users.map(user => {
      const userReceipts = receipts?.filter((r: any) => {
        const procedure = procedureMap.get(r.procedure_id)
        return r.user_id === user.id && procedure?.is_active === true
      }) || []

      const readCount = userReceipts.length
      const unreadCount = (totalProcedures || 0) - readCount
      const readPercentage = totalProcedures ? Math.round((readCount / totalProcedures) * 100) : 0

      // Get last read timestamp
      const lastRead = userReceipts.length > 0
        ? userReceipts.reduce((latest: any, current: any) => {
            const currentDate = new Date(current.acknowledged_at)
            const latestDate = latest ? new Date(latest) : new Date(0)
            return currentDate > latestDate ? current.acknowledged_at : latest
          }, null)
        : null

      return {
        user_id: user.id,
        full_name: user.full_name,
        role: user.role,
        read_count: readCount,
        unread_count: unreadCount,
        total_procedures: totalProcedures || 0,
        read_percentage: readPercentage,
        last_read_at: lastRead,
        read_procedures: userReceipts.map((r: any) => {
          const procedure = procedureMap.get(r.procedure_id)
          return {
            procedure_id: r.procedure_id,
            procedure_title: procedure?.title || 'Unknown',
            procedure_slug: procedure?.slug || '',
            acknowledged_at: r.acknowledged_at
          }
        })
      }
    })

    // Calculate overall stats
    const totalUsers = users.length
    const totalReads = receipts?.length || 0
    const averageReadPercentage = totalUsers > 0
      ? Math.round(userCompliance.reduce((sum, u) => sum + u.read_percentage, 0) / totalUsers)
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        total_procedures: totalProcedures || 0,
        total_users: totalUsers,
        total_reads: totalReads,
        average_read_percentage: averageReadPercentage
      },
      users: userCompliance
    })
  } catch (error) {
    console.error('Error in GET /api/procedures/compliance:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
