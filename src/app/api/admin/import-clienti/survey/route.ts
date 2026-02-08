export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const parseBoolean = (value: FormDataEntryValue | null, fallback: boolean) => {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const parseImportSummary = (stdout: string) => {
  const getCount = (label: string) => {
    const match = stdout.match(new RegExp(`${label}:\\s*(\\d+)`, 'i'))
    return match ? Number.parseInt(match[1], 10) : null
  }

  const batchIdMatch = stdout.match(/Batch ID:\s*([a-f0-9-]{36})/i)

  return {
    batchId: batchIdMatch?.[1] || null,
    totalRows: getCount('Total rows'),
    parsedRows: getCount('Parsed rows'),
    matchedHigh: getCount('High matches'),
    matchedMedium: getCount('Medium matches'),
    matchedLow: getCount('Low matches'),
    unmatched: getCount('Unmatched'),
    needsReview: getCount('Needs review'),
    followupsPending: getCount('Follow-up pending \\(live imports\\)')
  }
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli admin possono importare survey' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File CSV mancante' }, { status: 400 })
    }

    const isHistorical = parseBoolean(formData.get('isHistorical'), false)
    const dryRun = parseBoolean(formData.get('dryRun'), false)
    const autoMergeOrthographic = parseBoolean(formData.get('autoMergeOrthographic'), true)
    const notesRaw = formData.get('notes')
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() : ''

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Formato file non supportato. Carica un CSV.' }, { status: 400 })
    }

    const tempFileName = `survey-import-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`
    tempFilePath = path.join(os.tmpdir(), tempFileName)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(tempFilePath, fileBuffer)

    const scriptPath = path.join(process.cwd(), 'scripts', 'import_customer_survey_csv.mjs')
    const args: string[] = [
      scriptPath,
      '--file',
      tempFilePath,
      isHistorical ? '--historical' : '--live'
    ]

    if (dryRun) args.push('--dry-run')
    if (notes) args.push('--notes', notes)
    if (!autoMergeOrthographic) args.push('--no-auto-merge')

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024 * 12
    })

    const summary = parseImportSummary(stdout || '')
    const output = `${stdout || ''}${stderr || ''}`.trim()

    return NextResponse.json({
      success: true,
      dryRun,
      autoMergeOrthographic,
      summary,
      output
    })
  } catch (error: any) {
    const message = error?.stderr || error?.stdout || error?.message || 'Errore interno import survey'
    console.error('POST /api/admin/import-clienti/survey error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {})
    }
  }
}
