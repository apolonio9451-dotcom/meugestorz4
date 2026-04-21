ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS overdue_charge_cycles integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.clients.overdue_charge_cycles IS 'Quantidade de ciclos completos de cobrança de vencido já realizados (limite de 2 ciclos antes de parar e inativar)';