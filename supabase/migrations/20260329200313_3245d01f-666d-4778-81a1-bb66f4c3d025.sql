-- Harden chatbot-media storage ownership controls
DROP POLICY IF EXISTS "Authenticated users can delete chatbot media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete own chatbot-media" ON storage.objects;
CREATE POLICY "Allow authenticated delete own chatbot-media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chatbot-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM public.company_memberships
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload chatbot media" ON storage.objects;
CREATE POLICY "Authenticated users can upload own chatbot media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chatbot-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM public.company_memberships
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update chatbot media" ON storage.objects;
CREATE POLICY "Authenticated users can update own chatbot media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chatbot-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM public.company_memberships
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'chatbot-media'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM public.company_memberships
    WHERE user_id = auth.uid()
  )
);