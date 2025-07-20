-- Enable RLS on voice_notes table
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON voice_notes
    FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: Create individual policies if needed
-- CREATE POLICY "Allow read for authenticated users" ON voice_notes
--     FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow insert for authenticated users" ON voice_notes
--     FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- CREATE POLICY "Allow update for authenticated users" ON voice_notes
--     FOR UPDATE USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow delete for authenticated users" ON voice_notes
--     FOR DELETE USING (auth.role() = 'authenticated');