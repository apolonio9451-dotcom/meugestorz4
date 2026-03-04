
-- Create a trigger function that handles trial user signup
-- When a user signs up with trial metadata, create their membership in the trial company
CREATE OR REPLACE FUNCTION public.handle_trial_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trial_token text;
  _trial_company_id uuid;
  _trial_link_id uuid;
  _trial_expires_at timestamptz;
  _full_name text;
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');

  -- Only process if this is a trial signup
  IF _trial_token IS NOT NULL AND _trial_company_id IS NOT NULL THEN
    -- Create membership as trial operator
    INSERT INTO public.company_memberships (user_id, company_id, role, is_trial, trial_expires_at, trial_link_id)
    VALUES (NEW.id, _trial_company_id, 'operator', true, _trial_expires_at, _trial_link_id)
    ON CONFLICT DO NOTHING;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, _full_name)
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
$$;

-- Create trigger on auth.users for trial signups
DROP TRIGGER IF EXISTS on_trial_signup ON auth.users;
CREATE TRIGGER on_trial_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trial_signup();
