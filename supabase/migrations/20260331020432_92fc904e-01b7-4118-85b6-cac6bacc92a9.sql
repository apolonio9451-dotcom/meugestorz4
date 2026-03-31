
-- Update handle_trial_signup to create an isolated company for each trial user
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _token text;
  _trial trial_links%ROWTYPE;
  _parent_company_id uuid;
  _own_company_id uuid;
  _parent_reseller_id uuid;
  _new_reseller_id uuid;
  _trial_expires timestamptz;
  _user_name text;
BEGIN
  _token := NEW.raw_user_meta_data->>'trial_token';
  IF _token IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _trial FROM trial_links WHERE token = _token AND status = 'pending' LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _parent_company_id := _trial.company_id;
  _trial_expires := _trial.expires_at;
  _user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', _trial.client_name);

  -- Upsert profile
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    _user_name,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      email = EXCLUDED.email,
      avatar_url = COALESCE(NULLIF(profiles.avatar_url, ''), NULLIF(EXCLUDED.avatar_url, ''), profiles.avatar_url),
      updated_at = now();

  -- CREATE OWN ISOLATED COMPANY for the trial user (data isolation)
  INSERT INTO public.companies (name)
  VALUES (COALESCE(_user_name, 'Minha Empresa'))
  RETURNING id INTO _own_company_id;

  -- Create owner membership in OWN company (for data operations like plans, messages)
  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (_own_company_id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Create trial operator membership in PARENT company (for hierarchy visibility)
  INSERT INTO public.company_memberships (company_id, user_id, role, is_trial, trial_expires_at, trial_link_id)
  VALUES (_parent_company_id, NEW.id, 'operator', true, _trial_expires, _trial.id)
  ON CONFLICT DO NOTHING;

  -- Determine the parent reseller
  _parent_reseller_id := _trial.reseller_id;
  IF _parent_reseller_id IS NULL THEN
    SELECT id INTO _parent_reseller_id
    FROM public.resellers
    WHERE user_id = _trial.created_by
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Create a reseller record linked to PARENT company (for hierarchy)
  INSERT INTO public.resellers (
    company_id, user_id, name, email, whatsapp, status,
    parent_reseller_id, level, can_resell, can_create_trial,
    subscription_expires_at
  )
  VALUES (
    _parent_company_id,
    NEW.id,
    _user_name,
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

-- Add RLS policies for subscription_plans so resellers can manage their own company's plans
CREATE POLICY "Reseller can manage own subscription plans"
  ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Also create own company for existing trial users who don't have one
-- (data migration for existing users)
DO $$
DECLARE
  r RECORD;
  _new_company_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT cm.user_id, p.full_name
    FROM company_memberships cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.is_trial = true
    AND NOT EXISTS (
      SELECT 1 FROM company_memberships cm2
      WHERE cm2.user_id = cm.user_id AND cm2.role = 'owner'
    )
  LOOP
    INSERT INTO companies (name) VALUES (COALESCE(r.full_name, 'Minha Empresa'))
    RETURNING id INTO _new_company_id;

    INSERT INTO company_memberships (company_id, user_id, role)
    VALUES (_new_company_id, r.user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
