-- 1) Enforce one company membership per user (strict tenant isolation)
CREATE UNIQUE INDEX IF NOT EXISTS company_memberships_user_id_unique_idx
ON public.company_memberships (user_id);

-- 2) Prevent users from adding other users into their company (no shared access)
DROP POLICY IF EXISTS "Owner can add members" ON public.company_memberships;
CREATE POLICY "Users can only create own membership"
ON public.company_memberships
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 3) Ensure every new signup always gets its own company (ignore legacy is_reseller bypass)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = now();

  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;