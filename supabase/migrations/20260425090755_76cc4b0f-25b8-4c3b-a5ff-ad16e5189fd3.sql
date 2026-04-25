-- Create storage bucket for bolao celebrations
INSERT INTO storage.buckets (id, name, public) VALUES ('bolao-celebrations', 'bolao-celebrations', true);

-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'bolao-celebrations');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'bolao-celebrations' AND auth.role() = 'authenticated');
