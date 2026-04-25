-- Fix for all buckets to prevent broad listing
-- logos bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Access logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- chatbot-media bucket
CREATE POLICY "Access chatbot-media" ON storage.objects FOR SELECT USING (bucket_id = 'chatbot-media');

-- avatars bucket
CREATE POLICY "Access avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- campaigns bucket
CREATE POLICY "Access campaigns" ON storage.objects FOR SELECT USING (bucket_id = 'campaigns');

-- company-assets (already done, but keeping it clean)
DROP POLICY IF EXISTS "Public Access to company-assets" ON storage.objects;
CREATE POLICY "Access company-assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
