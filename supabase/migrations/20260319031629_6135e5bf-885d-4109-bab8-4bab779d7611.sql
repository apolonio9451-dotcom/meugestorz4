-- Enable extensions required for scheduled background processing
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Global toggle for mass broadcast queue
alter table public.api_settings
add column if not exists bulk_send_enabled boolean not null default false;

-- Campaigns for bulk send jobs
create table if not exists public.mass_broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null,
  name text not null default '',
  status text not null default 'queued',
  greeting_templates text[] not null default array['Olá!', 'Tudo bem?', 'Bom dia, como vai?'],
  offer_templates text[] not null default '{}',
  message_delay_min_seconds integer not null default 30,
  message_delay_max_seconds integer not null default 90,
  total_recipients integer not null default 0,
  processed_recipients integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null
);

create index if not exists idx_mass_broadcast_campaigns_company_created_at
  on public.mass_broadcast_campaigns(company_id, created_at desc);
create index if not exists idx_mass_broadcast_campaigns_company_status
  on public.mass_broadcast_campaigns(company_id, status);

alter table public.mass_broadcast_campaigns enable row level security;

create policy "Admins can manage mass broadcast campaigns"
on public.mass_broadcast_campaigns
for all
using (public.is_company_admin_or_owner(auth.uid(), company_id))
with check (public.is_company_admin_or_owner(auth.uid(), company_id));

create policy "Members can view mass broadcast campaigns"
on public.mass_broadcast_campaigns
for select
using (public.is_company_member(auth.uid(), company_id));

-- Recipients queued inside each campaign
create table if not exists public.mass_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mass_broadcast_campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  phone text not null,
  normalized_phone text not null,
  offer_template text not null default '',
  status text not null default 'pending',
  current_step text not null default 'greeting',
  next_action_at timestamp with time zone not null default now(),
  last_attempt_at timestamp with time zone null,
  sent_greeting_at timestamp with time zone null,
  sent_offer_at timestamp with time zone null,
  error_message text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (campaign_id, normalized_phone)
);

create index if not exists idx_mass_broadcast_recipients_campaign
  on public.mass_broadcast_recipients(campaign_id);
create index if not exists idx_mass_broadcast_recipients_due
  on public.mass_broadcast_recipients(company_id, status, next_action_at);

alter table public.mass_broadcast_recipients enable row level security;

create policy "Admins can manage mass broadcast recipients"
on public.mass_broadcast_recipients
for all
using (public.is_company_admin_or_owner(auth.uid(), company_id))
with check (public.is_company_admin_or_owner(auth.uid(), company_id));

create policy "Members can view mass broadcast recipients"
on public.mass_broadcast_recipients
for select
using (public.is_company_member(auth.uid(), company_id));

-- Delivery logs for monitoring
create table if not exists public.mass_broadcast_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.mass_broadcast_campaigns(id) on delete cascade,
  recipient_id uuid null references public.mass_broadcast_recipients(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  phone text not null,
  step text not null,
  status text not null,
  message text not null default '',
  error_message text null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_mass_broadcast_logs_campaign_created_at
  on public.mass_broadcast_logs(campaign_id, created_at desc);
create index if not exists idx_mass_broadcast_logs_company_created_at
  on public.mass_broadcast_logs(company_id, created_at desc);

alter table public.mass_broadcast_logs enable row level security;

create policy "Admins can manage mass broadcast logs"
on public.mass_broadcast_logs
for all
using (public.is_company_admin_or_owner(auth.uid(), company_id))
with check (public.is_company_admin_or_owner(auth.uid(), company_id));

create policy "Members can view mass broadcast logs"
on public.mass_broadcast_logs
for select
using (public.is_company_member(auth.uid(), company_id));

-- Reuse shared updated_at trigger helper
create trigger update_mass_broadcast_campaigns_updated_at
before update on public.mass_broadcast_campaigns
for each row
execute function public.update_updated_at_column();

create trigger update_mass_broadcast_recipients_updated_at
before update on public.mass_broadcast_recipients
for each row
execute function public.update_updated_at_column();

-- Realtime for monitor widgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mass_broadcast_campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_broadcast_campaigns;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mass_broadcast_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_broadcast_recipients;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mass_broadcast_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_broadcast_logs;
  END IF;
END $$;