-- 1. Remove unscoped chatbot-media DELETE policy (duplicate of scoped one)
DROP POLICY IF EXISTS "Authenticated users can delete chatbot media" ON storage.objects;

-- 2. Remove unscoped chatbot-media INSERT policy (duplicate of scoped one)  
DROP POLICY IF EXISTS "Authenticated users can upload chatbot media" ON storage.objects;

-- 3. Restrict client_mac_keys SELECT to admin/owner + assigned reseller only
DROP POLICY IF EXISTS "Members can view mac_keys" ON public.client_mac_keys;

-- Add admin/owner SELECT policy for mac_keys (replacing the broad "Members" one)
CREATE POLICY "Admin/Owner can view mac_keys"
  ON public.client_mac_keys
  FOR SELECT
  TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id));