
-- Make client_name have a default so trials can be generated without a name
ALTER TABLE public.trial_links ALTER COLUMN client_name SET DEFAULT 'Pendente';

-- Add trial tracking to company_memberships
ALTER TABLE public.company_memberships 
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS trial_link_id uuid REFERENCES public.trial_links(id) ON DELETE SET NULL;

-- Add user_id to trial_links to link signup user
ALTER TABLE public.trial_links ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
