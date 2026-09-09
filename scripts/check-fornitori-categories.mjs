#!/usr/bin/env node
// Guard against the "5 of 6 supplier tables" bug class (see docs/TECHNICAL_ARCHITECTURE_DEEP_DIVE.md,
// "Known Technical Debt" — fornitori_accessori was silently missing from 5 files).
//
// Any file that manually enumerates the fornitori_* tables/categories is doing something the
// shared src/lib/fornitori/categorie.ts module was built to centralize. This script doesn't
// enforce using that module (adoption is still per-file), but it does enforce that if a file
// enumerates the categories at all, it enumerates ALL of them — so a forgotten 7th category (or
// a copy-pasted partial list) fails the build instead of shipping silently.
//
// Run via `npm run check:fornitori-categories`, wired into `prebuild` so it runs before every
// `npm run build` (local and Vercel, since vercel.json's buildCommand is "npm run build").

import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')

// Canonical list — keep in sync with FORNITORE_CATEGORIES in src/lib/fornitori/categorie.ts
const CATEGORY_TABLES = [
  'fornitori_lenti',
  'fornitori_lac',
  'fornitori_montature',
  'fornitori_sport',
  'fornitori_lab_esterno',
  'fornitori_accessori',
]

// A file mentioning this many of the 6 is almost certainly doing a manual enumeration
// (as opposed to incidentally referencing one or two tables for an unrelated reason).
const ENUMERATION_THRESHOLD = 3

const EXTENSIONS = new Set(['.ts', '.tsx'])
// database.types.ts is the auto-generated schema mirror — always has all 6, not a bug source.
// categorie.ts is the source of truth itself — always has all 6 by definition.
const SKIP_FILES = new Set([
  path.join(srcDir, 'types', 'database.types.ts'),
  path.join(srcDir, 'lib', 'fornitori', 'categorie.ts'),
])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, files)
    } else if (EXTENSIONS.has(path.extname(entry))) {
      files.push(full)
    }
  }
  return files
}

function main() {
  const files = walk(srcDir)
  const problems = []

  for (const file of files) {
    if (SKIP_FILES.has(file)) continue
    const content = readFileSync(file, 'utf8')

    const present = CATEGORY_TABLES.filter((table) => content.includes(table))
    if (present.length >= ENUMERATION_THRESHOLD && present.length < CATEGORY_TABLES.length) {
      const missing = CATEGORY_TABLES.filter((table) => !present.includes(table))
      problems.push({ file: path.relative(rootDir, file), present, missing })
    }
  }

  if (problems.length > 0) {
    console.error('\n❌ fornitori_* category enumeration drift detected:\n')
    for (const p of problems) {
      console.error(`  ${p.file}`)
      console.error(`    has: ${p.present.join(', ')}`)
      console.error(`    MISSING: ${p.missing.join(', ')}\n`)
    }
    console.error(
      'Each file above manually enumerates the 6 supplier tables but is missing at least one.\n' +
      'Either add the missing table(s), or migrate the file to use resolveFornitoreAttivo()/\n' +
      'FORNITORE_CATEGORIES from src/lib/fornitori/categorie.ts.\n'
    )
    process.exit(1)
  }

  console.log(`✅ fornitori_* category check passed (${files.length} files scanned).`)
}

main()
