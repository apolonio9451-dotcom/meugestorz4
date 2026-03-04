
-- Update handle_trial_signup to also create a reseller record
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
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');
  _email := NEW.email;

  -- Only process if this is a trial signup
  IF _trial_token IS NOT NULL AND _trial_company_id IS NOT NULL THEN
    -- Create membership as trial operator
    INSERT INTO public.company_memberships (user_id, company_id, role, is_trial, trial_expires_at, trial_link_id)
    VALUES (NEW.id, _trial_company_id, 'operator', true, _trial_expires_at, _trial_link_id)
    ON CONFLICT DO NOTHING;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, _email, _full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = _full_name;

    -- Create reseller record with trial status
    INSERT INTO public.resellers (company_id, name, email, user_id, status, can_resell, can_create_subreseller, can_create_trial)
    VALUES (_trial_company_id, _full_name, _email, NEW.id, 'trial', false, false, false)
    ON CONFLICT DO NOTHING;

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

-- Also update handle_new_user to skip company creation for trial signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
BEGIN
  -- Skip for trial signups (handled by handle_trial_signup)
  IF (NEW.raw_user_meta_data->>'trial_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  IF (NEW.raw_user_meta_data->>'is_reseller') = 'true' THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
  RETURNING id INTO new_company_id;
  
  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$function$;
