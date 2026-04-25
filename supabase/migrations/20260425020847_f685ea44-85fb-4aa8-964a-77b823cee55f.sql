-- Drop existing policy
DROP POLICY "Public Access" ON storage.objects;

-- Create more restrictive SELECT policy for company-assets bucket
CREATE POLICY "Public Access to company-assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-assets');
