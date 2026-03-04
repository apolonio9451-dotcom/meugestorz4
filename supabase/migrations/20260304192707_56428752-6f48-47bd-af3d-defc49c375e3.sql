
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz DEFAULT NULL;

-- Update status values: ensure we support trial, expired, active, overdue
-- No enum needed since status is text field
