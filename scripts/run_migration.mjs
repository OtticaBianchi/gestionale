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

const migrationSql = `
-- Fix: Only increment procedure version when content actually changes
CREATE OR REPLACE FUNCTION update_procedure_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Always update the timestamp
  NEW.updated_at = NOW();

  -- Only increment version when meaningful content changes
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.content IS DISTINCT FROM NEW.content OR
      OLD.last_reviewed_at IS DISTINCT FROM NEW.last_reviewed_at
    ) THEN
      NEW.version = COALESCE(OLD.version, 0) + 1;
    ELSE
      NEW.version = OLD.version;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`

async function main() {
  console.log('Running migration to fix procedure version increment...')

  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSql })

  if (error) {
    // Try alternative: direct query won't work, but let's provide the SQL
    console.log('Note: Direct SQL execution requires database admin access.')
    console.log('Please run the following SQL in Supabase Dashboard > SQL Editor:')
    console.log('=' .repeat(60))
    console.log(migrationSql)
    console.log('=' .repeat(60))
    console.log('\nAlternatively, the migration file is at:')
    console.log('docs/database-migrations/fix_procedure_version_increment.sql')
    process.exit(0)
  }

  console.log('Migration completed successfully!')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
