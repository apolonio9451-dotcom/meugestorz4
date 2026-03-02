
-- Add credit_balance to companies table for controlling reseller creation
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 0;

-- Allow admin/owner to update company (already exists for owner, add for admin)
CREATE POLICY "Admin can update company"
ON public.companies
FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), id));
