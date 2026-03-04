
-- Update handle_trial_signup to prevent duplicate trials per email
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
  _existing_reseller_id uuid;
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');
  _email := NEW.email;

  -- Only process if this is a trial signup
  IF _trial_token IS NOT NULL AND _trial_company_id IS NOT NULL THEN
    -- Check if email already has a reseller record in this company (prevent duplicate trials)
    SELECT id INTO _existing_reseller_id
    FROM public.resellers
    WHERE email = _email AND company_id = _trial_company_id
    LIMIT 1;

    IF _existing_reseller_id IS NOT NULL THEN
      -- Update existing reseller record instead of creating new one
      UPDATE public.resellers
      SET user_id = NEW.id, status = 'trial', name = _full_name
      WHERE id = _existing_reseller_id;
    ELSE
      -- Create reseller record with trial status
      INSERT INTO public.resellers (company_id, name, email, user_id, status, can_resell, can_create_subreseller, can_create_trial)
      VALUES (_trial_company_id, _full_name, _email, NEW.id, 'trial', false, false, false)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Create membership as trial operator
    INSERT INTO public.company_memberships (user_id, company_id, role, is_trial, trial_expires_at, trial_link_id)
    VALUES (NEW.id, _trial_company_id, 'operator', true, _trial_expires_at, _trial_link_id)
    ON CONFLICT DO NOTHING;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, _email, _full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = _full_name;

    -- Update trial link with user info
    UPDATE public.trial_links 
    SET client_name = _full_name, 
        user_id = NEW.id,
        status = 'used'
    WHERE id = _trial_link_id;
  END IF;

  RETURN NEW;
END;
$function$;
