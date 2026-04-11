
-- Drop overly permissive chatbot-media policies
DROP POLICY IF EXISTS "Authenticated users can upload chatbot media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chatbot media" ON storage.objects;

-- Drop overly permissive logos policies
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
