ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS charge_pause_until date,
ADD COLUMN IF NOT EXISTS charge_pause_note text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_clients_charge_pause_until
ON public.clients (company_id, charge_pause_until);

COMMENT ON COLUMN public.clients.charge_pause_until IS 'Data até a qual as cobranças automáticas do cliente ficam pausadas manualmente.';
COMMENT ON COLUMN public.clients.charge_pause_note IS 'Observação opcional da pausa manual de cobrança.';