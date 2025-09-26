-- Procedures System Migration
-- Creates tables for the OB Procedures Manual system

-- Main procedures table
CREATE TABLE procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
  description TEXT,
  content TEXT NOT NULL, -- Full markdown content
  mini_help_title VARCHAR(100),
  mini_help_summary TEXT,
  mini_help_action VARCHAR(255),

  -- Categories and filters
  context_category TEXT CHECK (context_category IN (
    'accoglienza', 'vendita', 'appuntamenti', 'sala_controllo',
    'lavorazioni', 'consegna', 'customer_care', 'amministrazione', 'it',
    'sport', 'straordinarie'
  )),

  procedure_type TEXT CHECK (procedure_type IN (
    'checklist', 'istruzioni', 'formazione', 'errori_frequenti'
  )),

  -- Tags for roles (stored as array)
  target_roles TEXT[], -- e.g., ['addetti_vendita', 'optometrista']
  search_tags TEXT[], -- Additional searchable tags

  -- Metadata
  is_featured BOOLEAN DEFAULT FALSE, -- Show on main page
  is_active BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,

  -- Versioning
  version INTEGER DEFAULT 1,
  last_reviewed_at DATE,
  last_reviewed_by UUID REFERENCES profiles(id),

  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Procedure favorites (user bookmarks)
CREATE TABLE procedure_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES procedures(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, procedure_id)
);

-- Procedure access log (for analytics and recently viewed)
CREATE TABLE procedure_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  procedure_id UUID REFERENCES procedures(id),
  accessed_at TIMESTAMP DEFAULT NOW()
);

-- Procedure dependencies (related procedures)
CREATE TABLE procedure_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID REFERENCES procedures(id) ON DELETE CASCADE,
  depends_on_id UUID REFERENCES procedures(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'related' CHECK (relationship_type IN ('prerequisite', 'related', 'followup')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(procedure_id, depends_on_id)
);

-- Create indexes for better performance
CREATE INDEX idx_procedures_context_category ON procedures(context_category);
CREATE INDEX idx_procedures_procedure_type ON procedures(procedure_type);
CREATE INDEX idx_procedures_target_roles ON procedures USING GIN(target_roles);
CREATE INDEX idx_procedures_search_tags ON procedures USING GIN(search_tags);
CREATE INDEX idx_procedures_featured ON procedures(is_featured) WHERE is_featured = true;
CREATE INDEX idx_procedures_active ON procedures(is_active) WHERE is_active = true;
CREATE INDEX idx_procedure_access_log_user_id ON procedure_access_log(user_id);
CREATE INDEX idx_procedure_access_log_accessed_at ON procedure_access_log(accessed_at DESC);

-- Function to update view count
CREATE OR REPLACE FUNCTION increment_procedure_view_count(procedure_uuid UUID, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Update view count
  UPDATE procedures
  SET view_count = view_count + 1
  WHERE id = procedure_uuid;

  -- Log access for analytics and recently viewed
  INSERT INTO procedure_access_log (user_id, procedure_id)
  VALUES (user_uuid, procedure_uuid);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's recently viewed procedures
CREATE OR REPLACE FUNCTION get_recently_viewed_procedures(user_uuid UUID, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  slug VARCHAR,
  context_category TEXT,
  accessed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    p.title,
    p.slug,
    p.context_category,
    pal.accessed_at
  FROM procedure_access_log pal
  JOIN procedures p ON p.id = pal.procedure_id
  WHERE pal.user_id = user_uuid AND p.is_active = true
  ORDER BY p.id, pal.accessed_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_procedure_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'UPDATE' THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_procedures_timestamp
  BEFORE UPDATE ON procedures
  FOR EACH ROW
  EXECUTE FUNCTION update_procedure_timestamp();

-- Initial data seeding will be done separately
-- This creates the structure for the procedures system