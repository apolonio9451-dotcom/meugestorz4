CREATE OR REPLACE FUNCTION public.get_trial_link_by_token(_token text)
RETURNS TABLE (
  client_name text,
  expires_at timestamptz,
  created_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT tl.client_name, tl.expires_at, tl.created_at, tl.status
  FROM public.trial_links tl
  WHERE tl.token = _token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_trial_link_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_link_by_token(text) TO anon, authenticated;