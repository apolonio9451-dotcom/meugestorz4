-- Owner-only function to change reseller account plan (starter/pro)
CREATE OR REPLACE FUNCTION public.set_reseller_account_plan(
  _reseller_id uuid,
  _plan_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_company_id uuid;
  _target_user_id uuid;
  _target_company_id uuid;
BEGIN
  IF _plan_type NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Plano inválido: %', _plan_type;
  END IF;

  SELECT r.company_id, r.user_id
  INTO _parent_company_id, _target_user_id
  FROM public.resellers r
  WHERE r.id = _reseller_id
  LIMIT 1;

  IF _parent_company_id IS NULL THEN
    RAISE EXCEPTION 'Revendedor não encontrado';
  END IF;

  IF NOT public.has_company_role(auth.uid(), _parent_company_id, 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o Proprietário pode alterar o plano';
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
$$;

-- Owner/Admin function to read plan_type for all reseller accounts in a master company
CREATE OR REPLACE FUNCTION public.get_reseller_account_plans(
  _company_id uuid
)
RETURNS TABLE(reseller_id uuid, plan_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_company_admin_or_owner(auth.uid(), _company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH reseller_accounts AS (
    SELECT
      r.id AS reseller_id,
      (
        SELECT cm.company_id
        FROM public.company_memberships cm
        WHERE cm.user_id = r.user_id
        ORDER BY cm.created_at ASC
        LIMIT 1
      ) AS reseller_company_id
    FROM public.resellers r
    WHERE r.company_id = _company_id
  )
  SELECT
    ra.reseller_id,
    COALESCE(c.plan_type, 'pro')::text AS plan_type
  FROM reseller_accounts ra
  LEFT JOIN public.companies c ON c.id = ra.reseller_company_id;
END;
$$;