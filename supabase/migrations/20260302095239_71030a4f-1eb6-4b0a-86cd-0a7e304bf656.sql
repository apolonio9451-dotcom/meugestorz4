
-- Allow anonymous access to read trial links by token (for the public trial page)
CREATE POLICY "Anyone can view trial links by token"
  ON public.trial_links FOR SELECT
  TO anon
  USING (true);
