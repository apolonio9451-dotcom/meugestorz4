-- Fix logos bucket: scope DELETE and UPDATE to company ownership
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Owner can delete own logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_memberships WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Owner can update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.company_memberships WHERE user_id = auth.uid()
  )
);