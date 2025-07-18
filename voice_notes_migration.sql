-- Migration SQL per creare la tabella voice_notes
-- Eseguire questo SQL nel dashboard Supabase

CREATE TABLE IF NOT EXISTS voice_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_blob TEXT NOT NULL, -- Base64 encoded audio
    transcription TEXT NULL,
    addetto_nome TEXT NOT NULL,
    cliente_riferimento TEXT NULL,
    note_aggiuntive TEXT NULL,
    stato TEXT NOT NULL DEFAULT 'pending' 
        CHECK (stato IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    processed_by TEXT NULL,
    file_size INTEGER NULL,
    duration_seconds NUMERIC NULL
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_stato ON voice_notes(stato);
CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON voice_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_addetto ON voice_notes(addetto_nome);

-- RLS (Row Level Security) - opzionale se necessario
-- ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_voice_notes_updated_at
    BEFORE UPDATE ON voice_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_notes_updated_at();