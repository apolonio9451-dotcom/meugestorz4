
-- Add password_plain column to resellers table
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS password_plain text DEFAULT '';

-- Create security definer function: only owners can read passwords
CREATE OR REPLACE FUNCTION public.get_reseller_password(_reseller_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.company_memberships cm
      JOIN public.resellers r ON r.company_id = cm.company_id
      WHERE r.id = _reseller_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
    ) THEN (SELECT r.password_plain FROM public.resellers r WHERE r.id = _reseller_id)
    ELSE ''
  END
$$;

-- Update handle_trial_signup to save plain password from metadata
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _trial_token text;
  _trial_company_id uuid;
  _trial_link_id uuid;
  _trial_expires_at timestamptz;
  _full_name text;
  _email text;
  _whatsapp text;
  _password_plain text;
  _new_company_id uuid;
  _reseller_id uuid;
  _reseller_company_id uuid;
  _created_by uuid;
  _creator_reseller_id uuid;
  _new_reseller_id uuid;
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');
  _email := NEW.email;
  _whatsapp := COALESCE(NEW.raw_user_meta_data->>'whatsapp', '');
  _password_plain := COALESCE(NEW.raw_user_meta_data->>'plain_password', '');

  IF _trial_token IS NOT NULL AND _trial_company_id IS NOT NULL THEN
    INSERT INTO public.companies (name)
    VALUES (_full_name || ' (Teste)')
    RETURNING id INTO _new_company_id;

    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, _email, _full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = _full_name, email = _email;

    INSERT INTO public.company_memberships (user_id, company_id, role, is_trial, trial_expires_at, trial_link_id)
    VALUES (NEW.id, _new_company_id, 'owner', true, _trial_expires_at, _trial_link_id)
    ON CONFLICT DO NOTHING;

    SELECT reseller_id, company_id, created_by INTO _reseller_id, _reseller_company_id, _created_by
    FROM public.trial_links
    WHERE id = _trial_link_id;

    IF _reseller_id IS NOT NULL THEN
      INSERT INTO public.clients (name, email, whatsapp, company_id, reseller_id, status)
      VALUES (_full_name, _email, _whatsapp, _reseller_company_id, _reseller_id, 'trial');
    ELSE
      SELECT id INTO _creator_reseller_id
      FROM public.resellers
      WHERE user_id = _created_by
      LIMIT 1;

      INSERT INTO public.resellers (name, email, whatsapp, company_id, user_id, status, subscription_expires_at, parent_reseller_id, password_plain)
      VALUES (_full_name, _email, _whatsapp, _reseller_company_id, NEW.id, 'trial', _trial_expires_at, _creator_reseller_id, _password_plain)
      RETURNING id INTO _new_reseller_id;

      IF _new_reseller_id IS NOT NULL AND _whatsapp <> '' THEN
        INSERT INTO public.reseller_settings (reseller_id, support_whatsapp, service_name)
        VALUES (_new_reseller_id, _whatsapp, _full_name)
        ON CONFLICT (reseller_id) DO UPDATE SET support_whatsapp = _whatsapp;
      END IF;
    END IF;

    UPDATE public.trial_links 
    SET client_name = _full_name, 
        client_whatsapp = _whatsapp,
        user_id = NEW.id,
        status = 'used'
    WHERE id = _trial_link_id;

    -- Clear plain_password from user metadata for security
    UPDATE auth.users 
    SET raw_user_meta_data = raw_user_meta_data - 'plain_password'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
