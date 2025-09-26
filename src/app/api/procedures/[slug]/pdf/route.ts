export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - Generate PDF for procedure (admin only)
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

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono esportare PDF' }, { status: 403 })
    }

    const { slug } = await params

    // Use service role for query
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure
    const { data: procedure, error } = await adminClient
      .from('procedures')
      .select(`
        title,
        description,
        content,
        context_category,
        procedure_type,
        target_roles,
        last_reviewed_at,
        created_at
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !procedure) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    // Convert markdown content to HTML for PDF
    const contentHtml = procedure.content
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
      .replace(/^- \[ \] (.+)$/gm, '<div class="checklist-item">☐ $1</div>')
      .replace(/^- \[x\] (.+)$/gm, '<div class="checklist-item checked">☑ $1</div>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/❌ (.+)$/gm, '<div class="error-item">❌ $1</div>')
      .replace(/\n/g, '<br>')

    const categories = {
      'accoglienza': 'Accoglienza',
      'vendita': 'Vendita',
      'appuntamenti': 'Appuntamenti',
      'sala_controllo': 'Sala Controllo',
      'lavorazioni': 'Lavorazioni',
      'consegna': 'Consegna',
      'customer_care': 'Customer Care',
      'amministrazione': 'Amministrazione',
      'it': 'IT',
      'sport': 'Sport',
      'straordinarie': 'Straordinarie'
    }

    const types = {
      'checklist': 'Checklist',
      'istruzioni': 'Istruzioni',
      'formazione': 'Formazione',
      'errori_frequenti': 'Errori Frequenti'
    }

    const rolesMap = {
      'addetti_vendita': 'Addetti Vendita',
      'optometrista': 'Optometrista',
      'titolare': 'Titolare',
      'manager_responsabile': 'Manager/Responsabile',
      'laboratorio': 'Laboratorio',
      'responsabile_sport': 'Responsabile Sport'
    }

    const targetRoles = procedure.target_roles?.map((role: string) => rolesMap[role as keyof typeof rolesMap] || role).join(', ') || 'Tutti'

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${procedure.title} - Ottica Bianchi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #1f2937;
      margin-bottom: 10px;
      font-size: 2.2rem;
    }
    .header .company {
      color: #2563eb;
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .metadata {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #2563eb;
    }
    .metadata div {
      text-align: center;
    }
    .metadata .label {
      font-weight: 600;
      color: #374151;
      font-size: 0.9rem;
    }
    .metadata .value {
      color: #2563eb;
      font-size: 0.95rem;
    }
    .content {
      font-size: 1rem;
      line-height: 1.7;
    }
    h1, h2, h3 {
      color: #1f2937;
      margin: 25px 0 15px 0;
    }
    h1 { font-size: 1.8rem; }
    h2 { font-size: 1.4rem; }
    h3 { font-size: 1.2rem; }
    .checklist-item {
      margin: 8px 0;
      padding: 8px 12px;
      background: #f0f9ff;
      border-left: 3px solid #0ea5e9;
      border-radius: 4px;
    }
    .checklist-item.checked {
      background: #f0fdf4;
      border-left-color: #22c55e;
    }
    .error-item {
      margin: 8px 0;
      padding: 8px 12px;
      background: #fef2f2;
      border-left: 3px solid #ef4444;
      border-radius: 4px;
      color: #7f1d1d;
    }
    li {
      margin: 5px 0;
      margin-left: 20px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      color: #6b7280;
      font-size: 0.9rem;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    @media print {
      body { padding: 20px; }
      .header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Ottica Bianchi di Bianchi Enrico</div>
    <h1>${procedure.title}</h1>
    ${procedure.description ? `<p style="color: #6b7280; font-style: italic;">${procedure.description}</p>` : ''}
  </div>

  <div class="metadata">
    <div>
      <div class="label">Categoria</div>
      <div class="value">${categories[procedure.context_category as keyof typeof categories] || procedure.context_category}</div>
    </div>
    <div>
      <div class="label">Tipo</div>
      <div class="value">${types[procedure.procedure_type as keyof typeof types] || procedure.procedure_type}</div>
    </div>
    <div>
      <div class="label">Destinatari</div>
      <div class="value">${targetRoles}</div>
    </div>
    <div>
      <div class="label">Ultimo Aggiornamento</div>
      <div class="value">${new Date(procedure.last_reviewed_at || procedure.created_at).toLocaleDateString('it-IT')}</div>
    </div>
  </div>

  <div class="content">
    ${contentHtml}
  </div>

  <div class="footer">
    <p>📄 Documento generato automaticamente dal sistema di gestione procedure</p>
    <p>Ottica Bianchi - ${new Date().toLocaleDateString('it-IT')} - Esportato da: ${profile.full_name}</p>
    <p style="margin-top: 10px; font-size: 0.8rem;">
      Questo documento contiene procedure operative riservate di Ottica Bianchi
    </p>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="procedura-${slug}-${new Date().toISOString().split('T')[0]}.html"`
      }
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Errore generazione PDF' }, { status: 500 })
  }
}