-- Fix: Restrict saas_plans write access to service_role only
DROP POLICY IF EXISTS "Company owners can insert saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Company owners can update saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Company owners can delete saas plans" ON public.saas_plans;

CREATE POLICY "Only service_role can insert saas_plans"
ON public.saas_plans FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Only service_role can update saas_plans"
ON public.saas_plans FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Only service_role can delete saas_plans"
ON public.saas_plans FOR DELETE
TO service_role
USING (true);