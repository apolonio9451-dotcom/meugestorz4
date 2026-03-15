
CREATE OR REPLACE FUNCTION public.get_support_whatsapp(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT support_whatsapp
  FROM public.company_settings
  WHERE company_id = _company_id
  LIMIT 1
$$;
