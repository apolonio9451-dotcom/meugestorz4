-- Add league_id to sports_matches if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sports_matches' AND COLUMN_NAME = 'league_id') THEN
    ALTER TABLE public.sports_matches ADD COLUMN league_id INTEGER;
  END IF;
END $$;

-- No specific RLS changes needed as they usually apply to the whole table, 
-- but ensuring company_id check remains for multitenancy if applicable.
-- Assuming standard CRUD policies already exist.
