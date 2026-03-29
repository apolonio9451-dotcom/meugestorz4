
-- 1. Fix chatbot-media storage DELETE policy - add ownership check
DROP POLICY IF EXISTS "Allow authenticated delete chatbot-media" ON storage.objects;
CREATE POLICY "Allow authenticated delete own chatbot-media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chatbot-media'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.company_memberships WHERE user_id = auth.uid()
  )
);

-- 2. Add DELETE policy for company_settings
CREATE POLICY "Company admins can delete settings"
ON public.company_settings FOR DELETE TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- 3. Fix resellers_safe view - recreate with security_invoker
DROP VIEW IF EXISTS public.resellers_safe;
CREATE VIEW public.resellers_safe WITH (security_invoker = true) AS
SELECT
  id, company_id, name, email, whatsapp, status,
  can_create_subreseller, can_create_trial, can_resell,
  credit_balance, level, notes, parent_reseller_id,
  user_id, subscription_expires_at, created_at, updated_at
FROM public.resellers;

GRANT SELECT ON public.resellers_safe TO authenticated;
REVOKE ALL ON public.resellers_safe FROM anon;
