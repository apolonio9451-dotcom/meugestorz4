-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public access to company assets
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');

-- Create policy to allow authenticated users to upload company assets
CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update their assets
CREATE POLICY "Authenticated users can update assets" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete assets
CREATE POLICY "Authenticated users can delete assets" ON storage.objects FOR DELETE USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');
