-- scripts/migrate-database.sql
-- Migration script for PWA → Telegram Bot
-- Run this script on your Supabase database

-- ===== ADD TELEGRAM COLUMNS TO voice_notes =====
ALTER TABLE voice_notes 
ADD COLUMN IF NOT EXISTS telegram_message_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(50),  
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS audio_file_path VARCHAR(255);

-- ===== ADD AI ANALYSIS COLUMNS =====
ALTER TABLE voice_notes 
ADD COLUMN IF NOT EXISTS category_auto VARCHAR(50),
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(30),
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS extracted_dates JSON,
ADD COLUMN IF NOT EXISTS confidence_scores JSON,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- ===== CREATE TELEGRAM CONFIGURATION TABLE =====
CREATE TABLE IF NOT EXISTS telegram_config (
    id SERIAL PRIMARY KEY,
    bot_token VARCHAR(255) NOT NULL,
    webhook_url VARCHAR(255),
    active BOOLEAN DEFAULT true,
    max_file_size_mb INTEGER DEFAULT 20,
    auto_transcribe BOOLEAN DEFAULT true,
    auto_analyze BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CREATE INDEXES FOR PERFORMANCE =====
CREATE INDEX IF NOT EXISTS idx_voice_notes_telegram_user_id 
ON voice_notes(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_voice_notes_category_auto 
ON voice_notes(category_auto);

CREATE INDEX IF NOT EXISTS idx_voice_notes_sentiment 
ON voice_notes(sentiment);

CREATE INDEX IF NOT EXISTS idx_voice_notes_priority_level 
ON voice_notes(priority_level);

CREATE INDEX IF NOT EXISTS idx_voice_notes_needs_review 
ON voice_notes(needs_review);

-- ===== ADD COMMENTS =====
COMMENT ON COLUMN voice_notes.telegram_message_id IS 'ID del messaggio Telegram originale';
COMMENT ON COLUMN voice_notes.telegram_user_id IS 'ID utente Telegram';
COMMENT ON COLUMN voice_notes.telegram_username IS 'Username Telegram';
COMMENT ON COLUMN voice_notes.category_auto IS 'Categoria automatica AI: CLIENTE, TECNICO, AMMINISTRATIVO, etc.';
COMMENT ON COLUMN voice_notes.sentiment IS 'Sentiment analysis: NEUTRALE, PREOCCUPATO, FRUSTRATO, etc.';
COMMENT ON COLUMN voice_notes.priority_level IS 'Livello priorità 1-5 (1=molto bassa, 5=critica)';
COMMENT ON COLUMN voice_notes.extracted_dates IS 'Date/orari estratti automaticamente (JSON)';
COMMENT ON COLUMN voice_notes.confidence_scores IS 'Score di confidenza per ogni analisi (JSON)';
COMMENT ON COLUMN voice_notes.needs_review IS 'Flag per indicare se richiede revisione manuale';

-- ===== UPDATE EXISTING RECORDS (OPTIONAL) =====
-- Set default values for existing records
UPDATE voice_notes 
SET 
    category_auto = 'ALTRO',
    sentiment = 'NEUTRALE',
    priority_level = 2,
    needs_review = true,
    confidence_scores = '{"overall": 0.1}'::json
WHERE category_auto IS NULL;

-- ===== RLS POLICIES (Row Level Security) =====
-- Allow Telegram bot (service role) to insert/update
-- Existing policies for regular users should remain unchanged

-- Allow service role full access (for Telegram bot)
DROP POLICY IF EXISTS "telegram_bot_access" ON voice_notes;
CREATE POLICY "telegram_bot_access" ON voice_notes
    FOR ALL USING (auth.role() = 'service_role');

-- ===== VERIFICATION QUERIES =====
-- Check if migration was successful

-- Show new columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'voice_notes' 
  AND column_name IN (
    'telegram_message_id', 'telegram_user_id', 'telegram_username',
    'category_auto', 'sentiment', 'priority_level', 
    'extracted_dates', 'confidence_scores', 'needs_review'
  );

-- Show indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'voice_notes' 
  AND indexname LIKE 'idx_voice_notes_%';

-- Count existing records
SELECT 
    COUNT(*) as total_records,
    COUNT(telegram_user_id) as telegram_records,
    COUNT(category_auto) as categorized_records
FROM voice_notes;

-- Migration completed successfully!
SELECT 'PWA → Telegram Bot migration completed!' as status;