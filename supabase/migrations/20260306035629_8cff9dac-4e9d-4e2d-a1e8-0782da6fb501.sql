
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
  _new_company_id uuid;
  _reseller_id uuid;
  _reseller_company_id uuid;
  _created_by uuid;
  _creator_reseller_id uuid;
BEGIN
  _trial_token := NEW.raw_user_meta_data->>'trial_token';
  _trial_company_id := (NEW.raw_user_meta_data->>'trial_company_id')::uuid;
  _trial_link_id := (NEW.raw_user_meta_data->>'trial_link_id')::uuid;
  _trial_expires_at := (NEW.raw_user_meta_data->>'trial_expires_at')::timestamptz;
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Teste');
  _email := NEW.email;
  _whatsapp := COALESCE(NEW.raw_user_meta_data->>'whatsapp', '');

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
      -- Link created from ResellerPanel → create a client under that reseller
      INSERT INTO public.clients (name, email, whatsapp, company_id, reseller_id, status)
      VALUES (_full_name, _email, _whatsapp, _reseller_company_id, _reseller_id, 'trial');
    ELSE
      -- Link created from Resellers page → create a reseller
      -- Check if creator is a reseller (to set parent_reseller_id for sub-reseller hierarchy)
      SELECT id INTO _creator_reseller_id
      FROM public.resellers
      WHERE user_id = _created_by
      LIMIT 1;

      INSERT INTO public.resellers (name, email, whatsapp, company_id, user_id, status, subscription_expires_at, parent_reseller_id)
      VALUES (_full_name, _email, _whatsapp, _reseller_company_id, NEW.id, 'trial', _trial_expires_at, _creator_reseller_id);
    END IF;

    UPDATE public.trial_links 
    SET client_name = _full_name, 
        client_whatsapp = _whatsapp,
        user_id = NEW.id,
        status = 'used'
    WHERE id = _trial_link_id;
  END IF;

  RETURN NEW;
END;
$function$;
