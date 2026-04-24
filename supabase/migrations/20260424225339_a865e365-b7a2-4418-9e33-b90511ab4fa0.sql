-- Add credit_cost to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS credit_cost INTEGER DEFAULT 1;

-- Update existing plans to have at least 1 credit cost as a default if needed
UPDATE public.subscription_plans SET credit_cost = 1 WHERE credit_cost IS NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.subscription_plans.credit_cost IS 'Cost in credits/units to provide this plan (e.g., IPTV credit cost)';