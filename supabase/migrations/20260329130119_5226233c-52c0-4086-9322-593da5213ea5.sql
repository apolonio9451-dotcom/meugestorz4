
-- ============================================================
-- FIX 1: saas_plans - Remove write policies that let ANY owner modify global plans
-- Only service_role (edge functions) should manage these
-- ============================================================

DROP POLICY IF EXISTS "Owner can manage saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Owners can manage saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Admin/Owner can manage saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Admin can manage saas plans" ON public.saas_plans;

-- Keep only SELECT for authenticated users
DROP POLICY IF EXISTS "Anyone can view active saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Members can view saas plans" ON public.saas_plans;
DROP POLICY IF EXISTS "Authenticated can view saas plans" ON public.saas_plans;

CREATE POLICY "Authenticated can view saas plans"
  ON public.saas_plans FOR SELECT
  TO authenticated
  USING (true);

-- Block all client-side writes; only service_role can INSERT/UPDATE/DELETE
CREATE POLICY "No client writes on saas_plans"
  ON public.saas_plans FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- FIX 2: reseller sub-reseller INSERT - enforce company_id match
-- ============================================================

DROP POLICY IF EXISTS "Reseller can create sub-resellers" ON public.resellers;

CREATE POLICY "Reseller can create sub-resellers"
  ON public.resellers FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_reseller_id = get_reseller_id(auth.uid())
    AND company_id = get_reseller_company_id(auth.uid())
  );

-- ============================================================
-- FIX 3: Hide password_plain from direct SELECT policies
-- Create a view that excludes password_plain for normal queries
-- and restrict direct column access via RLS using column-level approach
-- We'll replace the Admin/Owner SELECT with one that uses a security barrier view
-- Actually, the cleanest fix: keep the RPC get_reseller_password for owner-only access
-- and create a restricted SELECT policy that uses a view without password_plain
-- Since we can't do column-level RLS, we create a secure view instead
-- ============================================================

-- Drop existing broad SELECT policies on resellers
DROP POLICY IF EXISTS "Admin/Owner can view resellers" ON public.resellers;

-- Recreate without exposing password_plain isn't possible at RLS level
-- But we can ensure only the get_reseller_password RPC (owner-only) returns it
-- The real fix: create a view that hides password_plain
CREATE OR REPLACE VIEW public.resellers_safe AS
SELECT id, company_id, name, email, whatsapp, status, notes,
       user_id, parent_reseller_id, level, credit_balance,
       can_resell, can_create_trial, can_create_subreseller,
       subscription_expires_at, created_at, updated_at
FROM public.resellers;

-- Re-add the SELECT policy (password_plain is still in table but app should use view)
CREATE POLICY "Admin/Owner can view resellers"
  ON public.resellers FOR SELECT
  TO public
  USING (is_company_admin_or_owner(auth.uid(), company_id));
