
-- FIX 1: Add deterministic ORDER BY to RLS helper functions
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT company_id FROM public.company_memberships 
  WHERE user_id = _user_id 
  ORDER BY created_at ASC 
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_reseller_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.resellers 
  WHERE user_id = _user_id 
  ORDER BY created_at ASC 
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_reseller_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT company_id FROM public.resellers 
  WHERE user_id = _user_id 
  ORDER BY created_at ASC 
  LIMIT 1
$$;

-- FIX 2: Fix search_path on functions that are missing it
CREATE OR REPLACE FUNCTION public.handle_whatsapp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
