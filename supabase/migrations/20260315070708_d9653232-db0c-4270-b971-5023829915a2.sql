
CREATE OR REPLACE FUNCTION public.set_reseller_account_plan(_reseller_id uuid, _plan_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _parent_company_id uuid;
  _target_user_id uuid;
  _target_company_id uuid;
  _parent_reseller_id uuid;
  _caller_reseller_id uuid;
BEGIN
  IF _plan_type NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Plano inválido: %', _plan_type;
  END IF;

  SELECT r.company_id, r.user_id, r.parent_reseller_id
  INTO _parent_company_id, _target_user_id, _parent_reseller_id
  FROM public.resellers r
  WHERE r.id = _reseller_id
  LIMIT 1;

  IF _parent_company_id IS NULL THEN
    RAISE EXCEPTION 'Revendedor não encontrado';
  END IF;

  -- Allow if caller is owner of the parent company
  IF public.has_company_role(auth.uid(), _parent_company_id, 'owner'::public.app_role) THEN
    -- Owner can always change plans
    NULL;
  ELSE
    -- Allow if caller is the parent reseller (cascading)
    _caller_reseller_id := (SELECT id FROM public.resellers WHERE user_id = auth.uid() LIMIT 1);
    IF _caller_reseller_id IS NULL OR _parent_reseller_id IS NULL OR _caller_reseller_id != _parent_reseller_id THEN
      RAISE EXCEPTION 'Apenas o Proprietário ou o revendedor pai pode alterar o plano';
    END IF;
    -- Parent reseller must be PRO to assign PRO
    IF _plan_type = 'pro' THEN
      DECLARE
        _parent_user_id uuid;
        _parent_own_company_id uuid;
        _parent_plan text;
      BEGIN
        SELECT user_id INTO _parent_user_id FROM public.resellers WHERE id = _caller_reseller_id;
        SELECT cm.company_id INTO _parent_own_company_id
        FROM public.company_memberships cm
        WHERE cm.user_id = _parent_user_id
        ORDER BY cm.created_at ASC LIMIT 1;
        SELECT c.plan_type INTO _parent_plan FROM public.companies c WHERE c.id = _parent_own_company_id;
        IF _parent_plan != 'pro' THEN
          RAISE EXCEPTION 'Seu plano deve ser PRO para atribuir PRO a sub-revendedores';
        END IF;
      END;
    END IF;
  END IF;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Revendedor sem usuário vinculado';
  END IF;

  SELECT cm.company_id
  INTO _target_company_id
  FROM public.company_memberships cm
  WHERE cm.user_id = _target_user_id
  ORDER BY cm.created_at ASC
  LIMIT 1;

  IF _target_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa do revendedor não encontrada';
  END IF;

  UPDATE public.companies
  SET plan_type = _plan_type,
      updated_at = now()
  WHERE id = _target_company_id;

  RETURN true;
END;
$function$;
