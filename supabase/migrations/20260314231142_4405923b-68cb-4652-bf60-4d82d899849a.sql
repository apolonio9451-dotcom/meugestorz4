
-- Fix RLS policies on auto_send_category_settings: parameter order was swapped
DROP POLICY IF EXISTS "Admins can manage category settings" ON public.auto_send_category_settings;
DROP POLICY IF EXISTS "Members can view their company category settings" ON public.auto_send_category_settings;

CREATE POLICY "Admins can manage category settings"
ON public.auto_send_category_settings
FOR ALL
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view their company category settings"
ON public.auto_send_category_settings
FOR SELECT
TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- Also add a unique constraint for upsert to work
ALTER TABLE public.auto_send_category_settings
DROP CONSTRAINT IF EXISTS auto_send_category_settings_company_category_unique;

ALTER TABLE public.auto_send_category_settings
ADD CONSTRAINT auto_send_category_settings_company_category_unique UNIQUE (company_id, category);
