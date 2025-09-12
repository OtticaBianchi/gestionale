-- Add dismissed_at field to voice_notes table
-- This field tracks when a voice note was dismissed/deleted from UI
-- NULL = active (visible in dashboard)
-- NOT NULL = dismissed (hidden from dashboard but data preserved)

ALTER TABLE voice_notes 
ADD COLUMN dismissed_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX idx_voice_notes_dismissed_at ON voice_notes(dismissed_at);

-- Add index for active notes (commonly queried)
CREATE INDEX idx_voice_notes_active ON voice_notes(created_at) WHERE dismissed_at IS NULL;

COMMENT ON COLUMN voice_notes.dismissed_at IS 'When the note was dismissed from UI. NULL=active, NOT NULL=dismissed but data preserved';