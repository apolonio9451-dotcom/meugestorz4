
-- Add user_id to resellers (links to auth.users for login)
ALTER TABLE public.resellers ADD COLUMN user_id UUID UNIQUE;

-- Add reseller_id to clients (nullable - null means direct company client)
ALTER TABLE public.clients ADD COLUMN reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

-- Helper: get reseller id from auth user
CREATE OR REPLACE FUNCTION public.get_reseller_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.resellers WHERE user_id = _user_id LIMIT 1 $$;

-- Helper: get reseller's company_id
CREATE OR REPLACE FUNCTION public.get_reseller_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.resellers WHERE user_id = _user_id LIMIT 1 $$;

-- Update handle_new_user to skip company creation for resellers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  IF (NEW.raw_user_meta_data->>'is_reseller') = 'true' THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
  RETURNING id INTO new_company_id;
  
  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$function$;

-- RLS: Reseller can view own record
CREATE POLICY "Reseller can view own record" ON public.resellers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Reseller can update own record" ON public.resellers FOR UPDATE USING (user_id = auth.uid());

-- RLS: Reseller client access
CREATE POLICY "Reseller can view own clients" ON public.clients FOR SELECT USING (reseller_id IS NOT NULL AND reseller_id = get_reseller_id(auth.uid()));
CREATE POLICY "Reseller can create clients" ON public.clients FOR INSERT WITH CHECK (reseller_id IS NOT NULL AND reseller_id = get_reseller_id(auth.uid()));
CREATE POLICY "Reseller can update own clients" ON public.clients FOR UPDATE USING (reseller_id IS NOT NULL AND reseller_id = get_reseller_id(auth.uid()));
CREATE POLICY "Reseller can delete own clients" ON public.clients FOR DELETE USING (reseller_id IS NOT NULL AND reseller_id = get_reseller_id(auth.uid()));

-- RLS: Reseller can view company plans
CREATE POLICY "Reseller can view company plans" ON public.subscription_plans FOR SELECT USING (company_id = get_reseller_company_id(auth.uid()));

-- RLS: Reseller subscription access (via their clients)
CREATE POLICY "Reseller can view own client subs" ON public.client_subscriptions FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE reseller_id = get_reseller_id(auth.uid())));
CREATE POLICY "Reseller can create client subs" ON public.client_subscriptions FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE reseller_id = get_reseller_id(auth.uid())));
CREATE POLICY "Reseller can update client subs" ON public.client_subscriptions FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE reseller_id = get_reseller_id(auth.uid())));

-- RLS: Reseller mac keys access
CREATE POLICY "Reseller can view own client mac keys" ON public.client_mac_keys FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE reseller_id = get_reseller_id(auth.uid())));
CREATE POLICY "Reseller can create client mac keys" ON public.client_mac_keys FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE reseller_id = get_reseller_id(auth.uid())));

-- RLS: Reseller can view own credit transactions
CREATE POLICY "Reseller can view own transactions" ON public.reseller_credit_transactions FOR SELECT USING (reseller_id = get_reseller_id(auth.uid()));

-- RLS: Reseller can view servers from their company
CREATE POLICY "Reseller can view company servers" ON public.servers FOR SELECT USING (company_id = get_reseller_company_id(auth.uid()));
