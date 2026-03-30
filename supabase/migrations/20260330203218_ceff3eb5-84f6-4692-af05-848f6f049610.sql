CREATE OR REPLACE FUNCTION public.can_access_client_record(_company_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_company_admin_or_owner(auth.uid(), _company_id)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = _client_id
        AND c.company_id = _company_id
        AND c.reseller_id = public.get_reseller_id(auth.uid())
    );
$$;

DROP POLICY IF EXISTS "Members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Admin/Owner can create clients" ON public.clients;
DROP POLICY IF EXISTS "Admin/Owner can view clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can create own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can delete own clients" ON public.clients;

CREATE POLICY "Admin/Owner can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can create own clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_reseller_company_id(auth.uid())
  AND reseller_id = public.get_reseller_id(auth.uid())
);

CREATE POLICY "Reseller can view own clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  company_id = public.get_reseller_company_id(auth.uid())
  AND reseller_id = public.get_reseller_id(auth.uid())
);

CREATE POLICY "Reseller can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_reseller_company_id(auth.uid())
  AND reseller_id = public.get_reseller_id(auth.uid())
)
WITH CHECK (
  company_id = public.get_reseller_company_id(auth.uid())
  AND reseller_id = public.get_reseller_id(auth.uid())
);

CREATE POLICY "Reseller can delete own clients"
ON public.clients
FOR DELETE
TO authenticated
USING (
  company_id = public.get_reseller_company_id(auth.uid())
  AND reseller_id = public.get_reseller_id(auth.uid())
);

DROP POLICY IF EXISTS "Members can view subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Admin/Owner can view subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can view own subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can create own subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can update own subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can delete own subscriptions" ON public.client_subscriptions;

CREATE POLICY "Admin/Owner can view subscriptions"
ON public.client_subscriptions
FOR SELECT
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can view own subscriptions"
ON public.client_subscriptions
FOR SELECT
TO authenticated
USING (public.can_access_client_record(company_id, client_id));

CREATE POLICY "Reseller can create own subscriptions"
ON public.client_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_client_record(company_id, client_id));

CREATE POLICY "Reseller can update own subscriptions"
ON public.client_subscriptions
FOR UPDATE
TO authenticated
USING (public.can_access_client_record(company_id, client_id))
WITH CHECK (public.can_access_client_record(company_id, client_id));

CREATE POLICY "Reseller can delete own subscriptions"
ON public.client_subscriptions
FOR DELETE
TO authenticated
USING (public.can_access_client_record(company_id, client_id));

DROP POLICY IF EXISTS "Members can view activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Members can create activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Admin/Owner can view activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Admin/Owner can create activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Reseller can view own client activity logs" ON public.client_activity_logs;
DROP POLICY IF EXISTS "Reseller can create own client activity logs" ON public.client_activity_logs;

CREATE POLICY "Admin/Owner can view activity logs"
ON public.client_activity_logs
FOR SELECT
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can create activity logs"
ON public.client_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can view own client activity logs"
ON public.client_activity_logs
FOR SELECT
TO authenticated
USING (
  client_id IS NOT NULL
  AND public.can_access_client_record(company_id, client_id)
);

CREATE POLICY "Reseller can create own client activity logs"
ON public.client_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IS NOT NULL
  AND created_by = auth.uid()
  AND public.can_access_client_record(company_id, client_id)
);

DROP POLICY IF EXISTS "Client credentials scoped select" ON public.client_credentials;
DROP POLICY IF EXISTS "Client credentials scoped insert" ON public.client_credentials;
DROP POLICY IF EXISTS "Client credentials scoped update" ON public.client_credentials;
DROP POLICY IF EXISTS "Client credentials scoped delete" ON public.client_credentials;

CREATE POLICY "Client credentials scoped select"
ON public.client_credentials
FOR SELECT
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Client credentials scoped insert"
ON public.client_credentials
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Client credentials scoped update"
ON public.client_credentials
FOR UPDATE
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id))
WITH CHECK (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Client credentials scoped delete"
ON public.client_credentials
FOR DELETE
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id));

ALTER VIEW public.resellers_safe SET (security_invoker = true);
REVOKE ALL ON public.resellers_safe FROM anon, authenticated;
GRANT SELECT ON public.resellers_safe TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chatbot media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chatbot media" ON storage.objects;

CREATE POLICY "Admin/Owner can upload own logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('owner'::public.app_role, 'admin'::public.app_role)
  )
);

CREATE POLICY "Admin/Owner can update own logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('owner'::public.app_role, 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('owner'::public.app_role, 'admin'::public.app_role)
  )
);

CREATE POLICY "Admin/Owner can delete own logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('owner'::public.app_role, 'admin'::public.app_role)
  )
);