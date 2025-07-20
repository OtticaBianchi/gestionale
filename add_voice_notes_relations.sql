-- Migration: Add cliente_id and busta_id columns to voice_notes table
-- Date: 2025-01-19
-- Description: Add foreign key relationships to link voice notes with clients and bustas

-- Step 1: Add the new columns
ALTER TABLE voice_notes 
ADD COLUMN cliente_id UUID NULL,
ADD COLUMN busta_id UUID NULL;

-- Step 2: Add foreign key constraints
ALTER TABLE voice_notes 
ADD CONSTRAINT voice_notes_cliente_id_fkey 
    FOREIGN KEY (cliente_id) REFERENCES clienti(id) ON DELETE SET NULL,
ADD CONSTRAINT voice_notes_busta_id_fkey 
    FOREIGN KEY (busta_id) REFERENCES buste(id) ON DELETE SET NULL;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_cliente_id ON voice_notes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_busta_id ON voice_notes(busta_id);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN voice_notes.cliente_id IS 'Foreign key to clienti table - links voice note to a specific client';
COMMENT ON COLUMN voice_notes.busta_id IS 'Foreign key to buste table - links voice note to a specific busta/job';

-- Optional: Update existing voice notes to link them with clients based on cliente_riferimento
-- This is a best-effort update that tries to match existing text references with actual clients
UPDATE voice_notes 
SET cliente_id = (
    SELECT c.id 
    FROM clienti c 
    WHERE voice_notes.cliente_riferimento IS NOT NULL
    AND voice_notes.cliente_riferimento != ''
    AND (
        LOWER(voice_notes.cliente_riferimento) LIKE LOWER('%' || c.nome || '%') 
        OR LOWER(voice_notes.cliente_riferimento) LIKE LOWER('%' || c.cognome || '%')
        OR LOWER(voice_notes.cliente_riferimento) LIKE LOWER('%' || c.nome || ' ' || c.cognome || '%')
    )
    LIMIT 1
)
WHERE cliente_id IS NULL 
AND cliente_riferimento IS NOT NULL 
AND cliente_riferimento != '';

-- Update busta_id for matched clients (find their most recent open busta)
UPDATE voice_notes 
SET busta_id = (
    SELECT b.id 
    FROM buste b 
    WHERE b.cliente_id = voice_notes.cliente_id
    AND b.stato_attuale IN ('nuove', 'materiali_ordinati', 'materiali_parzialmente_arrivati', 'materiali_arrivati', 'in_lavorazione')
    ORDER BY b.data_apertura DESC
    LIMIT 1
)
WHERE cliente_id IS NOT NULL 
AND busta_id IS NULL;

-- Success message
SELECT 'Migration completed successfully! Added cliente_id and busta_id columns to voice_notes table.' as result;