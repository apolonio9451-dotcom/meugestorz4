
-- Drop the overly permissive policy and replace with a service-role-only approach
-- Since edge functions use service_role key which bypasses RLS, we don't need an INSERT policy
DROP POLICY IF EXISTS "Edge function can insert logs" ON public.auto_send_logs;
