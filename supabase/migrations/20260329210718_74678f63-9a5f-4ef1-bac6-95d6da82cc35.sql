-- 1) Tighten access to client credentials with explicit, role-aware policies
DROP POLICY IF EXISTS "Scoped access to client credentials (select)" ON public.client_credentials;
DROP POLICY IF EXISTS "Scoped access to client credentials (insert)" ON public.client_credentials;
DROP POLICY IF EXISTS "Scoped access to client credentials (update)" ON public.client_credentials;
DROP POLICY IF EXISTS "Scoped access to client credentials (delete)" ON public.client_credentials;

CREATE POLICY "Client credentials scoped select"
ON public.client_credentials
FOR SELECT
TO authenticated
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_credentials.client_id
      AND c.company_id = client_credentials.company_id
      AND c.reseller_id = public.get_reseller_id(auth.uid())
  )
);

CREATE POLICY "Client credentials scoped insert"
ON public.client_credentials
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_credentials.client_id
      AND c.company_id = client_credentials.company_id
      AND c.reseller_id = public.get_reseller_id(auth.uid())
  )
);

CREATE POLICY "Client credentials scoped update"
ON public.client_credentials
FOR UPDATE
TO authenticated
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_credentials.client_id
      AND c.company_id = client_credentials.company_id
      AND c.reseller_id = public.get_reseller_id(auth.uid())
  )
)
WITH CHECK (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_credentials.client_id
      AND c.company_id = client_credentials.company_id
      AND c.reseller_id = public.get_reseller_id(auth.uid())
  )
);

CREATE POLICY "Client credentials scoped delete"
ON public.client_credentials
FOR DELETE
TO authenticated
USING (
  public.is_company_admin_or_owner(auth.uid(), company_id)
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_credentials.client_id
      AND c.company_id = client_credentials.company_id
      AND c.reseller_id = public.get_reseller_id(auth.uid())
  )
);

-- 2) Harden the safe reseller view exposure
ALTER VIEW public.resellers_safe SET (security_invoker = true, security_barrier = true);
REVOKE ALL ON public.resellers_safe FROM PUBLIC;
REVOKE ALL ON public.resellers_safe FROM anon;
GRANT SELECT ON public.resellers_safe TO authenticated;

-- 3) Restrict Realtime channel topics to the authenticated user's UUID prefix
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime own-topic read" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime own-topic write" ON realtime.messages;

CREATE POLICY "Realtime own-topic read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (split_part(topic, ':', 1) = auth.uid()::text);

CREATE POLICY "Realtime own-topic write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (split_part(topic, ':', 1) = auth.uid()::text);