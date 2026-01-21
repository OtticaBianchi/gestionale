import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { QUIZ_DATA, NO_QUIZ_PROCEDURES } from './add_quizzes_to_procedures.mjs'

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

const NO_QUIZ_KEYS = new Set(NO_QUIZ_PROCEDURES)
const DIFFICULTY_BY_NUMBER = {
  1: 'easy',
  2: 'medium',
  3: 'hard'
}

function validateQuizDefinition(fileKey) {
  const issues = []

  if (NO_QUIZ_KEYS.has(fileKey)) {
    return issues
  }

  const quiz = QUIZ_DATA[fileKey]
  if (!quiz) {
    return [`Quiz mancante per "${fileKey}"`]
  }

  if (!Array.isArray(quiz) || quiz.length !== 3) {
    issues.push('Il quiz deve avere esattamente 3 domande')
    return issues
  }

  const requiredNumbers = new Set([1, 2, 3])
  const seenNumbers = new Set()

  quiz.forEach((question, index) => {
    if (!question || typeof question !== 'object') {
      issues.push(`Domanda ${index + 1} non valida`)
      return
    }

    if (!Number.isInteger(question.number)) {
      issues.push(`Domanda ${index + 1}: numero mancante o non valido`)
    } else {
      seenNumbers.add(question.number)
    }

    if (!question.text || typeof question.text !== 'string') {
      issues.push(`Domanda ${question.number ?? index + 1}: testo mancante`)
    }

    if (!Array.isArray(question.options) || question.options.length !== 3) {
      issues.push(`Domanda ${question.number ?? index + 1}: servono 3 opzioni`)
      return
    }

    let correctCount = 0
    question.options.forEach((option, optionIndex) => {
      if (!option || typeof option !== 'object') {
        issues.push(`Domanda ${question.number ?? index + 1}: opzione ${optionIndex + 1} non valida`)
        return
      }
      if (!option.text || typeof option.text !== 'string') {
        issues.push(`Domanda ${question.number ?? index + 1}: opzione ${optionIndex + 1} senza testo`)
      }
      if (option.correct === true) {
        correctCount += 1
      } else if (option.correct !== false) {
        issues.push(`Domanda ${question.number ?? index + 1}: opzione ${optionIndex + 1} senza flag "correct"`)
      }
    })

    if (correctCount !== 1) {
      issues.push(`Domanda ${question.number ?? index + 1}: deve esserci una sola risposta corretta`)
    }
  })

  const missingNumbers = [...requiredNumbers].filter((number) => !seenNumbers.has(number))
  if (missingNumbers.length > 0) {
    issues.push(`Numeri domanda mancanti: ${missingNumbers.join(', ')}`)
  }

  return issues
}

function buildQuizRows(procedureId, quiz) {
  return quiz.map((question) => ({
    procedure_id: procedureId,
    question_number: question.number,
    question_text: question.text,
    difficulty: DIFFICULTY_BY_NUMBER[question.number] || 'medium',
    options: question.options.map((option) => ({
      text: option.text,
      is_correct: option.correct === true
    }))
  }))
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

async function loadExistingProcedures() {
  const { data, error } = await supabase
    .from('procedures')
    .select('id, slug, content')

  if (error) {
    throw new Error(`Failed to load existing procedures: ${error.message}`)
  }

  const map = new Map()
  data.forEach((row) => {
    map.set(row.slug, { id: row.id, content: row.content })
  })
  return map
}

async function main() {
  const procedureDir = path.join(rootDir, 'procedure_personale')
  const files = await fs.readdir(procedureDir)

  const existingProcedures = await loadExistingProcedures()
  const records = []
  const quizValidationIssues = []
  const quizKeyBySlug = new Map()
  const skippedUnchanged = []

  for (const fileName of files) {
    if (!fileName.endsWith('.md')) continue
    if (skipFiles.has(fileName)) continue
    const fileKey = fileName.replace(/\.md$/, '')
    const quizIssues = validateQuizDefinition(fileKey)
    if (quizIssues.length > 0) {
      quizValidationIssues.push({ fileKey, issues: quizIssues })
    }

    const filePath = path.join(procedureDir, fileName)
    const content = await fs.readFile(filePath, 'utf8')

    const titleLine = content.split('\n').find((line) => line.startsWith('# '))
    if (!titleLine) {
      console.warn(`Skipping ${fileName}: missing title heading`)
      continue
    }

    const title = titleLine.replace(/^#\s*/, '').trim()
    const slug = slugOverrides[fileName] || slugify(title)
    const existing = existingProcedures.get(slug)

    // Skip if content hasn't changed
    if (existing && existing.content === content) {
      skippedUnchanged.push(slug)
      continue
    }

    const isExisting = !!existing
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

    if (!NO_QUIZ_KEYS.has(fileKey)) {
      quizKeyBySlug.set(slug, fileKey)
    }

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

  if (quizValidationIssues.length > 0) {
    console.error('Quiz validation failed. Risolvi i problemi prima di importare:')
    quizValidationIssues.forEach(({ fileKey, issues }) => {
      issues.forEach((issue) => {
        console.error(`- ${fileKey}: ${issue}`)
      })
    })
    process.exit(1)
  }

  if (skippedUnchanged.length > 0) {
    console.log(`Skipped ${skippedUnchanged.length} unchanged procedures`)
  }

  if (records.length === 0) {
    console.log('No procedures to import or update.')
    return
  }

  const { data, error } = await supabase
    .from('procedures')
    .upsert(records, { onConflict: 'slug' })
    .select('id, slug')

  if (error) {
    console.error('Failed to upsert procedures:', error)
    process.exit(1)
  }

  const quizRows = []

  data.forEach((row) => {
    const quizKey = quizKeyBySlug.get(row.slug)
    if (!quizKey) return
    const quiz = QUIZ_DATA[quizKey]
    if (!quiz) return
    quizRows.push(...buildQuizRows(row.id, quiz))
  })

  if (quizRows.length > 0) {
    const { error: quizError } = await supabase
      .from('procedure_quiz_questions')
      .upsert(quizRows, { onConflict: 'procedure_id,question_number' })

    if (quizError) {
      console.error('Failed to upsert quiz questions:', quizError)
      process.exit(1)
    }
  }

  console.log('Imported procedures:', data.map((row) => row.slug))
  if (quizRows.length > 0) {
    console.log(`Upserted quiz questions: ${quizRows.length}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
