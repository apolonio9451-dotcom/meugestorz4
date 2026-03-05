
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
  _new_company_id uuid;
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');
  _email := NEW.email;

  -- Only process if this is a trial signup
  IF _trial_token IS NOT NULL AND _trial_company_id IS NOT NULL THEN
    -- Create a NEW separate company for the trial user (data isolation)
    INSERT INTO public.companies (name)
    VALUES (_full_name || ' (Teste)')
    RETURNING id INTO _new_company_id;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, _email, _full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = _full_name;

    -- Create membership in the NEW company as owner with trial flag
    INSERT INTO public.company_memberships (user_id, company_id, role, is_trial, trial_expires_at, trial_link_id)
    VALUES (NEW.id, _new_company_id, 'owner', true, _trial_expires_at, _trial_link_id)
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
