
-- 1. Remove overly permissive chatbot-media storage policies
DROP POLICY IF EXISTS "Authenticated users can upload chatbot media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chatbot media" ON storage.objects;

-- 2. Remove overly permissive logos storage policies
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- 3. Fix subscription_plans reseller policy to use correct function
DROP POLICY IF EXISTS "Reseller can manage own subscription plans" ON public.subscription_plans;
CREATE POLICY "Reseller can manage own subscription plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));
