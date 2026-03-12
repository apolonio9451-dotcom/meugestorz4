
-- Create storage bucket for chatbot media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chatbot-media', 'chatbot-media', true, 52428800, ARRAY['audio/mpeg', 'audio/mp3', 'video/mp4']);

-- Storage policies
CREATE POLICY "Authenticated users can upload chatbot media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chatbot-media');

CREATE POLICY "Anyone can view chatbot media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chatbot-media');

CREATE POLICY "Authenticated users can delete chatbot media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chatbot-media');
