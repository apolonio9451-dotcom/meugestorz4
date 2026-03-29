-- Make resellers_safe view use SECURITY INVOKER so caller's RLS applies
CREATE OR REPLACE VIEW public.resellers_safe
WITH (security_invoker = true)
AS
SELECT id, company_id, name, email, whatsapp, status, notes, user_id,
       parent_reseller_id, level, credit_balance, can_resell, can_create_trial,
       can_create_subreseller, subscription_expires_at, created_at, updated_at
FROM public.resellers;