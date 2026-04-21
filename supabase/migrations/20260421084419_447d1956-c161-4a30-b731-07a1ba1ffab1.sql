-- Adiciona controle anti-spam para cobrança de clientes vencidos
-- Lógica: 2 dias seguidos enviando, depois pausa 3 dias, e repete o ciclo
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS overdue_charge_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdue_charge_resume_date date;

COMMENT ON COLUMN public.clients.overdue_charge_streak IS 'Quantidade de dias consecutivos em que a cobrança de vencido foi enviada (reinicia ao atingir o limite de 2)';
COMMENT ON COLUMN public.clients.overdue_charge_resume_date IS 'Data a partir da qual a cobrança de vencido pode voltar a ser enviada após o ciclo de pausa anti-spam';