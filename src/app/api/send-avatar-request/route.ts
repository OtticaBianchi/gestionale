// 1. API Route: app/api/send-avatar-request/route.ts
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

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    // Parse form data (file + info)
    const formData = await request.formData()
    const avatarFile = formData.get('avatar') as File
    const userName = formData.get('userName') as string
    const userEmail = formData.get('userEmail') as string
    const userRole = formData.get('userRole') as string

    if (!avatarFile) {
      return NextResponse.json({ error: 'Nessun file allegato' }, { status: 400 })
    }

    // Validate file
    if (!avatarFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo immagini sono permesse' }, { status: 400 })
    }

    if (avatarFile.size > 10 * 1024 * 1024) { // 10MB max
      return NextResponse.json({ error: 'File troppo grande (max 10MB)' }, { status: 400 })
    }

    // Convert file to buffer for email attachment
    const arrayBuffer = await avatarFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Configure Aruba SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtps.aruba.it',
      port: 465,
      secure: true,
      auth: {
        user: 'info@otticabianchispezia.it',
        pass: process.env.ARUBA_EMAIL_PASSWORD, // In .env.local
      },
    })

    const mailOptions = {
      from: {
        name: 'Gestionale Ottica Bianchi',
        address: 'info@otticabianchispezia.it'
      },
      to: 'timoteopasquali.business@gmail.com', // ← CAMBIA con la tua email personale
      subject: `[Gestionale] Nuova richiesta avatar - ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🖼️ Nuova Richiesta Cambio Avatar</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e40af;">📋 Dettagli Utente:</h3>
            <ul style="line-height: 1.6;">
              <li><strong>Nome:</strong> ${userName}</li>
              <li><strong>Email:</strong> ${userEmail}</li>
              <li><strong>Ruolo:</strong> ${userRole}</li>
              <li><strong>User ID:</strong> ${user.id}</li>
            </ul>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">📎 File Allegato:</h3>
            <ul style="line-height: 1.6;">
              <li><strong>Nome file:</strong> ${avatarFile.name}</li>
              <li><strong>Tipo:</strong> ${avatarFile.type}</li>
              <li><strong>Dimensione:</strong> ${(avatarFile.size / 1024).toFixed(1)} KB</li>
            </ul>
          </div>

          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="margin-top: 0; color: #166534;">🎯 Prossimi Step:</h3>
            <ol style="line-height: 1.8;">
              <li>Scarica l'immagine allegata</li>
              <li>Ottimizza/ridimensiona se necessario</li>
              <li>Accedi al gestionale come admin</li>
              <li>Vai in <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 3px;">/admin/avatar-management</code></li>
              <li>Cerca <strong>${userName}</strong></li>
              <li>Upload del nuovo avatar</li>
            </ol>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; line-height: 1.4;">
            📧 Email automatica dal Gestionale Ottica Bianchi<br>
            🕐 ${new Date().toLocaleString('it-IT')}<br>
            🤖 Non rispondere a questa email - è generata automaticamente
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `avatar-${userName.replace(/\s+/g, '')}-${Date.now()}.${avatarFile.name.split('.').pop()}`,
          content: buffer,
          contentType: avatarFile.type
        }
      ]
    }

    // Send email
    await transporter.sendMail(mailOptions)

    return NextResponse.json({ 
      success: true, 
      message: 'Richiesta avatar inviata con successo!' 
    })

  } catch (error: any) {
    console.error('❌ Avatar request error:', error)
    return NextResponse.json({ 
      error: `Errore invio richiesta: ${error.message}` 
    }, { status: 500 })
  }
}
