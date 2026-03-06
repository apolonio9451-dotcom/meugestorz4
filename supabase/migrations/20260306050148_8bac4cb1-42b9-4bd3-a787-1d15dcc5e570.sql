
-- Allow resellers to insert credit transactions for their sub-resellers
CREATE POLICY "Reseller can create sub-reseller credit transactions"
ON public.reseller_credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  reseller_id IN (
    SELECT id FROM public.resellers WHERE parent_reseller_id = get_reseller_id(auth.uid())
  )
);

-- Allow resellers to view their sub-resellers' credit transactions
CREATE POLICY "Reseller can view sub-reseller transactions"
ON public.reseller_credit_transactions
FOR SELECT
TO authenticated
USING (
  reseller_id IN (
    SELECT id FROM public.resellers WHERE parent_reseller_id = get_reseller_id(auth.uid())
  )
);
