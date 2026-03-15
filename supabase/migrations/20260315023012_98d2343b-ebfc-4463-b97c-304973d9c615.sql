
-- Update handle_new_user to save Google avatar_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
  _is_trial boolean;
BEGIN
  _is_trial := COALESCE((NEW.raw_user_meta_data->>'is_trial')::boolean, false);

  IF _is_trial THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      email = EXCLUDED.email,
      avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), NULLIF(EXCLUDED.avatar_url, ''), profiles.avatar_url),
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

-- Also update handle_trial_signup to save Google avatar
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token text;
  _trial trial_links%ROWTYPE;
  _company_id uuid;
BEGIN
  _token := NEW.raw_user_meta_data->>'trial_token';
  IF _token IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _trial FROM trial_links WHERE token = _token AND status = 'pending' LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _company_id := _trial.company_id;

  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', _trial.client_name),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      email = EXCLUDED.email,
      avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), NULLIF(EXCLUDED.avatar_url, ''), profiles.avatar_url),
      updated_at = now();

  INSERT INTO public.company_memberships (company_id, user_id, role, is_trial, trial_expires_at, trial_link_id)
  VALUES (_company_id, NEW.id, 'operator', true, _trial.expires_at, _trial.id)
  ON CONFLICT DO NOTHING;

  UPDATE trial_links
  SET status = 'activated', activated_at = now(), user_id = NEW.id
  WHERE id = _trial.id;

  RETURN NEW;
END;
$function$;
