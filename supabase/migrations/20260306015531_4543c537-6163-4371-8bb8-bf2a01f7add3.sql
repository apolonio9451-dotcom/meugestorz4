
DROP FUNCTION public.get_trial_link_by_token(text);

CREATE FUNCTION public.get_trial_link_by_token(_token text)
 RETURNS TABLE(id uuid, client_name text, expires_at timestamp with time zone, created_at timestamp with time zone, status text, company_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.client_name, tl.expires_at, tl.created_at, tl.status, tl.company_id
  FROM public.trial_links tl
  WHERE tl.token = _token
  LIMIT 1
$function$;
