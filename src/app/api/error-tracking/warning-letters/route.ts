import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Verifica che sia admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli amministratori possono gestire le lettere di richiamo' }, { status: 403 })
    }

    // Usa il service role per operazioni privilegiate
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get() { return undefined },
        },
      }
    )

    const body = await request.json()
    const { action, letterData, emailData } = body

    switch (action) {
      case 'save':
        return await saveLetter(serviceSupabase, user.id, letterData)

      case 'send':
        return await sendLetter(serviceSupabase, user.id, letterData, emailData)

      case 'record-verbal':
        return await recordVerbalWarning(serviceSupabase, user.id, letterData)

      default:
        return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('❌ Warning letters API error:', error)
    return NextResponse.json({
      error: `Errore del server: ${error.message}`
    }, { status: 500 })
  }
}

async function saveLetter(supabase: any, userId: string, letterData: any) {
  try {
    // Converti il PDF base64 in buffer per il database
    if (!letterData.pdfData) {
      return NextResponse.json({ error: 'PDF data mancante' }, { status: 400 })
    }

    const pdfBuffer = Buffer.from(letterData.pdfData, 'base64')

    const { data, error } = await supabase
      .from('warning_letters')
      .insert({
        employee_id: letterData.employeeId,
        employee_name: letterData.employeeName,
        letter_type: letterData.letterType,
        pdf_data: pdfBuffer,
        generated_by: userId,
        total_errors: letterData.stats.totalErrors || 0,
        critical_errors: letterData.stats.criticalErrors || 0,
        total_cost: letterData.stats.totalCost || 0,
        weekly_errors: letterData.stats.weeklyErrors || 0,
        monthly_errors: letterData.stats.monthlyErrors || 0
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Errore nel salvare la lettera' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Lettera salvata con successo',
      letterId: data.id
    })

  } catch (error: any) {
    console.error('Save letter error:', error)
    return NextResponse.json({ error: 'Errore nel salvare la lettera' }, { status: 500 })
  }
}

async function sendLetter(supabase: any, userId: string, letterData: any, emailData: any) {
  try {
    // Prima salva la lettera
    const saveResult = await saveLetter(supabase, userId, letterData)
    if (!saveResult.ok) {
      return saveResult
    }

    const saveResultBody = await saveResult.json()
    const letterId = saveResultBody.letterId

    // Configura il trasportatore email (usando la stessa configurazione degli altri servizi)
    const transporter = nodemailer.createTransport({
      host: 'smtps.aruba.it',
      port: 465,
      secure: true,
      auth: {
        user: 'info@otticabianchispezia.it',
        pass: process.env.ARUBA_EMAIL_PASSWORD,
      },
    })

    const letterTypeNames = {
      verbal: 'Richiamo Verbale',
      written: 'Richiamo Scritto',
      disciplinary: 'Provvedimento Disciplinare'
    }

    const mailOptions = {
      from: {
        name: 'Ottica Bianchi - Gestionale',
        address: 'info@otticabianchispezia.it'
      },
      to: emailData.recipientEmail,
      cc: emailData.ccEmails || [],
      subject: `${letterTypeNames[letterData.letterType as keyof typeof letterTypeNames]} - ${letterData.employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">📋 ${letterTypeNames[letterData.letterType as keyof typeof letterTypeNames]}</h2>

          <p>Gentile ${letterData.employeeName},</p>

          <p>In allegato troverà la lettera di richiamo ufficiale relativa agli errori operativi registrati.</p>

          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">📊 Riepilogo Errori:</h3>
            <ul style="line-height: 1.6;">
              <li><strong>Errori totali:</strong> ${letterData.stats.totalErrors || 0}</li>
              <li><strong>Errori critici:</strong> ${letterData.stats.criticalErrors || 0}</li>
              <li><strong>Costo totale stimato:</strong> €${(letterData.stats.totalCost || 0).toFixed(2)}</li>
            </ul>
          </div>

          ${emailData.customMessage ? `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151;">💬 Messaggio aggiuntivo:</h3>
              <p style="line-height: 1.6;">${emailData.customMessage}</p>
            </div>
          ` : ''}

          <p>È possibile richiedere un incontro con la direzione per discutere i punti evidenziati.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            📧 Email automatica dal Gestionale Ottica Bianchi<br>
            🕐 ${new Date().toLocaleString('it-IT')}<br>
            📋 ID Lettera: ${letterId}
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `lettera-richiamo-${letterData.employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
          content: Buffer.from(letterData.pdfData, 'base64'),
          contentType: 'application/pdf'
        }
      ]
    }

    // Invia l'email
    await transporter.sendMail(mailOptions)

    // Aggiorna il record della lettera con i dettagli dell'invio
    await supabase
      .from('warning_letters')
      .update({
        sent_via_email: true,
        sent_at: new Date().toISOString(),
        sent_to_email: emailData.recipientEmail
      })
      .eq('id', letterId)

    return NextResponse.json({
      success: true,
      message: 'Lettera salvata e inviata via email con successo',
      letterId: letterId
    })

  } catch (error: any) {
    console.error('Send letter error:', error)
    return NextResponse.json({
      error: `Errore nell'invio dell'email: ${error.message}`
    }, { status: 500 })
  }
}

async function recordVerbalWarning(supabase: any, userId: string, letterData: any) {
  try {
    // Per richiami verbali, registriamo solo i metadati senza PDF
    const { data, error } = await supabase
      .from('warning_letters')
      .insert({
        employee_id: letterData.employeeId,
        employee_name: letterData.employeeName,
        letter_type: letterData.letterType,
        pdf_data: null, // Nessun PDF per richiami verbali
        generated_by: userId,
        total_errors: letterData.stats.totalErrors || 0,
        critical_errors: letterData.stats.criticalErrors || 0,
        total_cost: letterData.stats.totalCost || 0,
        weekly_errors: letterData.stats.weeklyErrors || 0,
        monthly_errors: letterData.stats.monthlyErrors || 0,
        // Salviamo le note nel campo che normalmente contiene il PDF
        notes: letterData.notes || 'Richiamo verbale registrato'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Errore nel registrare il richiamo verbale' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Richiamo verbale registrato con successo',
      recordId: data.id
    })

  } catch (error: any) {
    console.error('Record verbal warning error:', error)
    return NextResponse.json({ error: 'Errore nel registrare il richiamo verbale' }, { status: 500 })
  }
}

// GET per recuperare le lettere salvate
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Verifica che sia almeno manager
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { data: letters, error } = await supabase
      .from('warning_letters')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: 'Errore nel recuperare le lettere' }, { status: 500 })
    }

    return NextResponse.json({ letters })

  } catch (error: any) {
    console.error('❌ Get warning letters error:', error)
    return NextResponse.json({
      error: `Errore del server: ${error.message}`
    }, { status: 500 })
  }
}