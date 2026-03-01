
-- Fix: restrict company creation to only via trigger (no direct inserts)
DROP POLICY "Authenticated can create company" ON public.companies;
CREATE POLICY "No direct company creation" ON public.companies FOR INSERT
  TO authenticated WITH CHECK (false);
