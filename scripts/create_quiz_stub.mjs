#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { QUIZ_DATA, NO_QUIZ_PROCEDURES } from './add_quizzes_to_procedures.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const usage = () => {
  console.log('Usage: node scripts/create_quiz_stub.mjs <procedure_markdown_path> [--dry-run]')
  console.log('Example: node scripts/create_quiz_stub.mjs procedure_personale/nuova-procedura.md')
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const targetArg = args.find((arg) => !arg.startsWith('--'))

if (!targetArg) {
  usage()
  process.exit(1)
}

const resolvedPath = path.isAbsolute(targetArg)
  ? targetArg
  : path.resolve(process.cwd(), targetArg)

if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`)
  process.exit(1)
}

if (path.extname(resolvedPath) !== '.md') {
  console.error('Please provide a markdown file (.md).')
  process.exit(1)
}

const fileKey = path.basename(resolvedPath, '.md')

if (NO_QUIZ_PROCEDURES.includes(fileKey)) {
  console.error(`Quiz not required for: ${fileKey}`)
  process.exit(1)
}

if (QUIZ_DATA[fileKey]) {
  console.error(`Quiz already exists for: ${fileKey}`)
  process.exit(1)
}

const content = fs.readFileSync(resolvedPath, 'utf8')
const titleLine = content.split('\n').find((line) => line.startsWith('# '))
const title = titleLine ? titleLine.replace(/^#\s*/, '').trim() : fileKey

const quizEntry = `  '${fileKey}': [\n` +
  `    {\n` +
  `      number: 1,\n` +
  `      text: 'DOMANDA 1 (facile) - da compilare (${title})',\n` +
  `      options: [\n` +
  `        { text: 'Risposta corretta (da compilare)', correct: true },\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false },\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false }\n` +
  `      ]\n` +
  `    },\n` +
  `    {\n` +
  `      number: 2,\n` +
  `      text: 'DOMANDA 2 (media) - da compilare (${title})',\n` +
  `      options: [\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false },\n` +
  `        { text: 'Risposta corretta (da compilare)', correct: true },\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false }\n` +
  `      ]\n` +
  `    },\n` +
  `    {\n` +
  `      number: 3,\n` +
  `      text: 'DOMANDA 3 (difficile, mini-caso) - da compilare (${title})',\n` +
  `      options: [\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false },\n` +
  `        { text: 'Risposta corretta (da compilare)', correct: true },\n` +
  `        { text: 'Risposta errata (da compilare)', correct: false }\n` +
  `      ]\n` +
  `    }\n` +
  `  ]`

if (dryRun) {
  console.log('\nQuiz entry preview:\n')
  console.log(quizEntry)
  console.log('\nNo files were modified (--dry-run).')
  process.exit(0)
}

const quizFilePath = path.join(__dirname, 'add_quizzes_to_procedures.mjs')
const source = fs.readFileSync(quizFilePath, 'utf8')

const marker = 'export const QUIZ_DATA = {'
const markerIndex = source.indexOf(marker)
if (markerIndex === -1) {
  console.error('Unable to locate QUIZ_DATA in add_quizzes_to_procedures.mjs')
  process.exit(1)
}

const openIndex = source.indexOf('{', markerIndex)
let depth = 0
let endIndex = -1

for (let i = openIndex; i < source.length; i += 1) {
  const char = source[i]
  if (char === '{') depth += 1
  if (char === '}') depth -= 1
  if (depth === 0) {
    endIndex = i
    break
  }
}

if (endIndex === -1) {
  console.error('Unable to locate QUIZ_DATA closing brace')
  process.exit(1)
}

const before = source.slice(0, endIndex)
const after = source.slice(endIndex)
const needsComma = !before.trimEnd().endsWith(',')
const insertion = `${needsComma ? ',' : ''}\n${quizEntry}\n`

const updated = before + insertion + after
fs.writeFileSync(quizFilePath, updated, 'utf8')

console.log(`Quiz stub created for: ${fileKey}`)
console.log(`Updated: ${quizFilePath}`)
console.log('Remember to replace placeholder questions with real content before importing.')
