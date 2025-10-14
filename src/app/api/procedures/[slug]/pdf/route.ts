export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import puppeteer from 'puppeteer'
import { marked } from 'marked'

// Configure marked for GFM (GitHub Flavored Markdown) with tables
marked.setOptions({
  gfm: true,
  breaks: true,
})

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

    // Convert markdown content to HTML using marked
    const contentHtml = await marked(procedure.content)

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
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #1f2937;
      margin-bottom: 10px;
      font-size: 1.8rem;
    }
    .header .company {
      color: #2563eb;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .metadata {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
      border-left: 4px solid #2563eb;
    }
    .metadata div {
      text-align: center;
    }
    .metadata .label {
      font-weight: 600;
      color: #374151;
      font-size: 0.8rem;
      margin-bottom: 4px;
    }
    .metadata .value {
      color: #2563eb;
      font-size: 0.85rem;
    }
    .content {
      font-size: 0.95rem;
      line-height: 1.7;
    }
    .content h1, .content h2, .content h3 {
      color: #1f2937;
      margin: 20px 0 12px 0;
      page-break-after: avoid;
    }
    .content h1 { font-size: 1.6rem; }
    .content h2 { font-size: 1.3rem; }
    .content h3 { font-size: 1.1rem; }
    .content p {
      margin: 8px 0;
    }
    .content ul, .content ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    .content li {
      margin: 5px 0;
    }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 0.9rem;
      page-break-inside: avoid;
    }
    .content table th {
      background: #f3f4f6;
      padding: 10px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #d1d5db;
    }
    .content table td {
      padding: 8px 10px;
      border: 1px solid #d1d5db;
    }
    .content table tr:nth-child(even) {
      background: #f9fafb;
    }
    .content blockquote {
      border-left: 4px solid #2563eb;
      padding-left: 15px;
      margin: 15px 0;
      color: #4b5563;
      font-style: italic;
    }
    .content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .content pre {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 12px 0;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content strong {
      font-weight: 600;
      color: #1f2937;
    }
    .content hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 20px 0;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #6b7280;
      font-size: 0.85rem;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      page-break-inside: avoid;
    }
    @media print {
      body { padding: 20px; }
      .header { page-break-after: avoid; }
      .metadata { page-break-after: avoid; }
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

    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })

    await browser.close()

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="procedura-${slug}-${new Date().toISOString().split('T')[0]}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Errore generazione PDF' }, { status: 500 })
  }
}