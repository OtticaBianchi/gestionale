import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(rootDir, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const CATEGORY_VALUES = new Set([
  'accoglienza',
  'vendita',
  'appuntamenti',
  'sala_controllo',
  'lavorazioni',
  'consegna',
  'customer_care',
  'amministrazione',
  'it',
  'sport',
  'straordinarie'
])

const PROCEDURE_TYPES = new Set([
  'checklist',
  'istruzioni',
  'formazione',
  'errori_frequenti'
])

const ROLE_VALUES = new Set([
  'addetti_vendita',
  'optometrista',
  'titolare',
  'manager_responsabile',
  'laboratorio',
  'responsabile_sport'
])

const skipFiles = new Set([
  'elenco_procedure_client_side.md'
])

const slugOverrides = {
  'annullamento-riprogrammazione-appuntamento.md': 'annullamento-riprogrammazione-appuntamento',
  'carico_occhiali_luxottica_stars.md': 'carico-occhiali-luxottica-stars',
  'conferma-appuntamento.md': 'conferma-appuntamento-sms-whatsapp',
  'gestione_astucci_montature_luxottica.md': 'gestione-astucci-occhiali-luxottica',
  'gestione_buoni_dipendenti_luxottica.md': 'gestione-buoni-dipendenti-luxottica',
  'lenti-filtro-antiluceblu.md': 'consulenza-lenti-filtro-antiluceblu',
  'note_vocali_telegram.md': 'utilizzo-note-vocali-telegram',
  'busta_lavoro.md': 'procedura-creazione-busta-lavoro',
  'follow-up_clienti_multifocali.md': 'ricontatto-clienti-lenti-varifocali',
  'introduttiva.md': 'procedura-introduttiva-benvenuto',
  'pulizia_riesposizione_occhiali.md': 'pulizia-riesposizione-occhiali',
  'registrazione-appuntamenti.md': 'registrazione-appuntamenti',
  'rispondere-al-telefono.md': 'risposta-al-telefono',
  'consegna_lenti_progressive.md': 'consegna-occhiali-lenti-progressive',
  'assumersi-resposanbilita-posto-lavoro.md': 'assumersi-responsabilita-posto-lavoro',
  'gestione-casi-non-previsti.md': 'gestione-casi-non-previsti'
}

const categoryOverrides = {
  'annullamento-riprogrammazione-appuntamento': 'appuntamenti',
  'carico-occhiali-luxottica-stars': 'lavorazioni',
  'conferma-appuntamento-sms-whatsapp': 'appuntamenti',
  'gestione-astucci-occhiali-luxottica': 'lavorazioni',
  'gestione-buoni-dipendenti-luxottica': 'amministrazione',
  'ricontatto-clienti-lenti-varifocali': 'customer_care',
  'consulenza-lenti-filtro-antiluceblu': 'vendita',
  'utilizzo-note-vocali-telegram': 'it',
  'pulizia-riesposizione-occhiali': 'lavorazioni',
  'registrazione-appuntamenti': 'appuntamenti',
  'risposta-al-telefono': 'accoglienza',
  'assumersi-responsabilita-posto-lavoro': 'customer_care',
  'gestione-casi-non-previsti': 'customer_care'
}

const typeOverrides = {
  'annullamento-riprogrammazione-appuntamento': 'istruzioni',
  'carico-occhiali-luxottica-stars': 'checklist',
  'conferma-appuntamento-sms-whatsapp': 'checklist',
  'gestione-astucci-occhiali-luxottica': 'checklist',
  'gestione-buoni-dipendenti-luxottica': 'istruzioni',
  'ricontatto-clienti-lenti-varifocali': 'checklist',
  'consulenza-lenti-filtro-antiluceblu': 'istruzioni',
  'utilizzo-note-vocali-telegram': 'istruzioni',
  'pulizia-riesposizione-occhiali': 'checklist',
  'registrazione-appuntamenti': 'istruzioni',
  'risposta-al-telefono': 'checklist',
  'assumersi-responsabilita-posto-lavoro': 'istruzioni',
  'gestione-casi-non-previsti': 'istruzioni'
}

const profileNameToId = new Map([
  ['sabattini valentina', '7aa3d53c-4c3c-46d0-bfb0-0d265bf0f8c1'],
  ['valentina sabattini', '7aa3d53c-4c3c-46d0-bfb0-0d265bf0f8c1'],
  ['marco comparini', '6ef6f59f-04f9-44ed-9567-aed8ee0da4ba'],
  ['comparini marco', '6ef6f59f-04f9-44ed-9567-aed8ee0da4ba'],
  ['pasquali timoteo', 'ba647344-f9a2-4248-884e-b2590d3dd6f5'],
  ['timoteo pasquali', 'ba647344-f9a2-4248-884e-b2590d3dd6f5'],
])

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function sanitiseKeyword(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractTags(content) {
  const tagMatch = content.match(/\*\*Tag:\*\*([^\n]+)/)
  if (!tagMatch) return []
  return tagMatch[1]
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function pickCategory(slug, tags) {
  if (categoryOverrides[slug]) return categoryOverrides[slug]
  return tags.find((tag) => CATEGORY_VALUES.has(tag)) || null
}

function pickType(slug, tags) {
  if (typeOverrides[slug]) return typeOverrides[slug]
  return tags.find((tag) => PROCEDURE_TYPES.has(tag)) || 'istruzioni'
}

function pickRoles(tags) {
  return tags.filter((tag) => ROLE_VALUES.has(tag))
}

function extractDescription(content) {
  const scopoMatch = content.match(/##\s*1\.\s*Scopo\s*\n([\s\S]*?)(?:\n##\s*\d|\n###\s|$)/i)
  if (!scopoMatch) return ''

  const rawBlock = scopoMatch[1]
    .replace(/\r/g, '')
    .trim()

  const firstParagraph = rawBlock.split(/\n\s*\n/)[0] || rawBlock

  return firstParagraph
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMiniHelp(content) {
  const miniHelpMatch = content.match(/###\s*\*{0,2}Mini-Help[^\n]*\n([\s\S]*)/i)
  if (!miniHelpMatch) return {}

  const block = miniHelpMatch[1]

  const titleMatch = block.match(/\*\*Titolo sintetico:\*\*\s*([^\n]+)/i)
  const summaryMatch = block.match(/\*\*In sintesi:\*\*\s*([^\n]+)/i)
  const actionMatch = block.match(/\*\*Azione rapida:\*\*\s*([^\n]+)/i)

  const clean = (value) =>
    value
      ? value
          .replace(/\r/g, '')
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : null

  return {
    mini_help_title: clean(titleMatch?.[1]) || null,
    mini_help_summary: clean(summaryMatch?.[1]) || null,
    mini_help_action: clean(actionMatch?.[1]) || null
  }
}

function extractLastReviewedAt(content) {
  const dateMatch = content.match(/Ultima\s+revisione:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (!dateMatch) {
    return new Date().toISOString().split('T')[0]
  }

  const [, day, month, year] = dateMatch
  return `${year}-${month}-${day}`
}

function buildSearchTags(slug, tags, title) {
  const excluded = new Set([...CATEGORY_VALUES, ...PROCEDURE_TYPES, ...ROLE_VALUES])
  const keywords = new Set()

  tags.forEach((tag) => {
    if (!excluded.has(tag)) {
      const keyword = sanitiseKeyword(tag)
      if (keyword) keywords.add(keyword)
    }
  })

  title
    .toLowerCase()
    .split(/[\s/()–-]+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length > 2 && !['procedura', 'ottica', 'bianchi'].includes(word))
    .forEach((word) => keywords.add(word))

  // Ensure slug keywords contribute as a fallback
  slug
    .split('-')
    .filter((part) => part.length > 2)
    .forEach((part) => keywords.add(part))

  return Array.from(keywords).slice(0, 10)
}

function extractMetadata(content) {
  const authorMatch = content.match(/\*\*Autore:\*\*\s*([^\n]+)/i) || content.match(/Autore:\s*([^\n]+)/i)
  const reviewerMatch = content.match(/Responsabile aggiornamento:\s*([^\n]+)/i)

  const clean = (value) =>
    value
      ? value
          .replace(/\*\*/g, '')
          .replace(/[-*]/g, '')
          .trim()
      : null

  const author = clean(authorMatch?.[1])
  const reviewer = clean(reviewerMatch?.[1])

  const normalise = (value) => (value ? value.toLowerCase() : null)

  const authorId = profileNameToId.get(normalise(author)) || null
  const reviewerId = profileNameToId.get(normalise(reviewer)) || null

  return {
    author,
    reviewer,
    authorId,
    reviewerId
  }
}

async function loadExistingSlugs() {
  const { data, error } = await supabase
    .from('procedures')
    .select('slug')

  if (error) {
    throw new Error(`Failed to load existing procedures: ${error.message}`)
  }

  return new Set(data.map((row) => row.slug))
}

async function main() {
  const procedureDir = path.join(rootDir, 'procedure_personale')
  const files = await fs.readdir(procedureDir)

  const existingSlugs = await loadExistingSlugs()
  const records = []

  for (const fileName of files) {
    if (!fileName.endsWith('.md')) continue
    if (skipFiles.has(fileName)) continue

    const filePath = path.join(procedureDir, fileName)
    const content = await fs.readFile(filePath, 'utf8')

    const titleLine = content.split('\n').find((line) => line.startsWith('# '))
    if (!titleLine) {
      console.warn(`Skipping ${fileName}: missing title heading`)
      continue
    }

    const title = titleLine.replace(/^#\s*/, '').trim()
    const slug = slugOverrides[fileName] || slugify(title)
    const isExisting = existingSlugs.has(slug)
    console.log(`${isExisting ? 'Aggiornamento' : 'Import'}: ${slug}`)

    const tags = extractTags(content)
    const context_category = pickCategory(slug, tags)

    if (!context_category) {
      console.warn(`Skipping ${fileName}: unable to determine context category`)
      continue
    }

    const procedure_type = pickType(slug, tags)
    const target_roles = pickRoles(tags)
    const description = extractDescription(content)
    const { mini_help_title, mini_help_summary, mini_help_action } = extractMiniHelp(content)
    const last_reviewed_at = extractLastReviewedAt(content)
    const search_tags = buildSearchTags(slug, tags, title)
    const metadata = extractMetadata(content)

    const createdById = metadata.authorId
    const updatedById = metadata.reviewerId || metadata.authorId
    const lastReviewedById = metadata.reviewerId || metadata.authorId

    records.push({
      title,
      slug,
      description,
      content,
      context_category,
      procedure_type,
      target_roles,
      search_tags,
      is_featured: false,
      is_active: true,
      mini_help_title,
      mini_help_summary,
      mini_help_action,
      created_by: createdById,
      updated_by: updatedById,
      last_reviewed_by: lastReviewedById,
      last_reviewed_at
    })
  }

  if (records.length === 0) {
    console.log('No new procedures to import.')
    return
  }

  const { data, error } = await supabase
    .from('procedures')
    .upsert(records, { onConflict: 'slug' })
    .select('slug')

  if (error) {
    console.error('Failed to upsert procedures:', error)
    process.exit(1)
  }

  console.log('Imported procedures:', data.map((row) => row.slug))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
