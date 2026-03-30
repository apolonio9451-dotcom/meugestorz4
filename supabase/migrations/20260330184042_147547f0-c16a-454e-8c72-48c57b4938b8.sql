
-- Update handle_trial_signup to also create a reseller record linked to the parent
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
  _parent_reseller_id uuid;
  _new_reseller_id uuid;
  _trial_expires timestamptz;
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
  _trial_expires := _trial.expires_at;

  -- Upsert profile
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

  -- Create company membership as trial operator
  INSERT INTO public.company_memberships (company_id, user_id, role, is_trial, trial_expires_at, trial_link_id)
  VALUES (_company_id, NEW.id, 'operator', true, _trial_expires, _trial.id)
  ON CONFLICT DO NOTHING;

  -- Determine the parent reseller: either the reseller_id on the trial_link,
  -- or find the reseller record of the user who created the link
  _parent_reseller_id := _trial.reseller_id;
  IF _parent_reseller_id IS NULL THEN
    SELECT id INTO _parent_reseller_id
    FROM public.resellers
    WHERE user_id = _trial.created_by
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Create a reseller record for the new user, linked to the parent
  INSERT INTO public.resellers (
    company_id, user_id, name, email, whatsapp, status,
    parent_reseller_id, level, can_resell, can_create_trial,
    subscription_expires_at
  )
  VALUES (
    _company_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', _trial.client_name),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    'trial',
    _parent_reseller_id,
    CASE WHEN _parent_reseller_id IS NOT NULL THEN
      COALESCE((SELECT level + 1 FROM public.resellers WHERE id = _parent_reseller_id), 1)
    ELSE 1
    END,
    true,
    true,
    _trial_expires
  )
  ON CONFLICT DO NOTHING;

  -- Activate the trial link
  UPDATE trial_links
  SET status = 'activated', activated_at = now(), user_id = NEW.id
  WHERE id = _trial.id;

  RETURN NEW;
END;
$function$;
