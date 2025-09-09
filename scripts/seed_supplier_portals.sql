-- Seed placeholder web portals for suppliers
-- NOTE: Replace placeholders with real URLs when available.
-- This script only fills empty web_address fields; it will not overwrite existing values.

-- Lenti (Hoya, Zeiss, Essilor)
UPDATE fornitori_lenti
SET web_address = 'https://portal.hoya.it' -- placeholder
WHERE nome ILIKE 'hoya%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_lenti
SET web_address = 'https://b2b.zeiss.it' -- placeholder
WHERE nome ILIKE 'zeiss%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_lenti
SET web_address = 'https://pro.essilor.it' -- placeholder
WHERE nome ILIKE 'essilor%'
  AND (web_address IS NULL OR web_address = '');

-- Laboratorio esterno (generic placeholder if named accordingly)
UPDATE fornitori_lab_esterno
SET web_address = 'https://lab.example' -- placeholder
WHERE nome ILIKE '%laboratorio%'
  AND (web_address IS NULL OR web_address = '');

-- Montature (Luxottica common)
UPDATE fornitori_montature
SET web_address = 'https://b2b.luxottica.com' -- placeholder
WHERE nome ILIKE '%luxottica%'
  AND (web_address IS NULL OR web_address = '');

-- LAC (examples: Alcon, CooperVision, J&J, Bausch)
UPDATE fornitori_lac
SET web_address = 'https://b2b.alcon.example' -- placeholder
WHERE nome ILIKE '%alcon%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_lac
SET web_address = 'https://pro.coopervision.example' -- placeholder
WHERE nome ILIKE '%cooper%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_lac
SET web_address = 'https://jnjvisionpro.example' -- placeholder
WHERE nome ILIKE '%johnson%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_lac
SET web_address = 'https://bauschlombpro.example' -- placeholder
WHERE nome ILIKE '%bausch%'
  AND (web_address IS NULL OR web_address = '');

-- Sport (examples)
UPDATE fornitori_sport
SET web_address = 'https://b2b.oakley.example' -- placeholder
WHERE nome ILIKE '%oakley%'
  AND (web_address IS NULL OR web_address = '');

UPDATE fornitori_sport
SET web_address = 'https://b2b.rudyproject.example' -- placeholder
WHERE nome ILIKE '%rudy%'
  AND (web_address IS NULL OR web_address = '');

-- Verification queries (optional)
-- SELECT id, nome, web_address FROM fornitori_lenti WHERE nome ILIKE 'hoya%' OR nome ILIKE 'zeiss%' OR nome ILIKE 'essilor%';
-- SELECT id, nome, web_address FROM fornitori_montature WHERE nome ILIKE '%luxottica%';
-- SELECT id, nome, web_address FROM fornitori_lac WHERE web_address IS NOT NULL;
-- SELECT id, nome, web_address FROM fornitori_sport WHERE web_address IS NOT NULL;

