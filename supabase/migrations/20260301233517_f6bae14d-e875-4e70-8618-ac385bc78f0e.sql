
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'operator');

-- Tabela de empresas
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de perfis (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de membros da empresa (roles separados)
CREATE TABLE public.company_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Tabela de clientes
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de planos
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de assinaturas dos clientes
CREATE TABLE public.client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Security definer function: check if user is member of company
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Security definer function: check if user has specific role in company
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  )
$$;

-- Security definer function: check owner or admin
CREATE OR REPLACE FUNCTION public.is_company_admin_or_owner(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id AND company_id = _company_id AND role IN ('owner', 'admin')
  )
$$;

-- Get user's company id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_memberships WHERE user_id = _user_id LIMIT 1
$$;

-- RLS: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- RLS: companies
CREATE POLICY "Members can view their company" ON public.companies FOR SELECT
  USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "Owner can update company" ON public.companies FOR UPDATE
  USING (public.has_company_role(auth.uid(), id, 'owner'));
CREATE POLICY "Authenticated can create company" ON public.companies FOR INSERT
  TO authenticated WITH CHECK (true);

-- RLS: company_memberships
CREATE POLICY "Members can view memberships" ON public.company_memberships FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Owner can add members" ON public.company_memberships FOR INSERT
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'owner')
    OR user_id = auth.uid()
  );
CREATE POLICY "Owner can remove members" ON public.company_memberships FOR DELETE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- RLS: clients
CREATE POLICY "Members can view clients" ON public.clients FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can create clients" ON public.clients FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can update clients" ON public.clients FOR UPDATE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can delete clients" ON public.clients FOR DELETE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- RLS: subscription_plans
CREATE POLICY "Members can view plans" ON public.subscription_plans FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can create plans" ON public.subscription_plans FOR INSERT
  WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can update plans" ON public.subscription_plans FOR UPDATE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can delete plans" ON public.subscription_plans FOR DELETE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- RLS: client_subscriptions
CREATE POLICY "Members can view subscriptions" ON public.client_subscriptions FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can create subscriptions" ON public.client_subscriptions FOR INSERT
  WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can update subscriptions" ON public.client_subscriptions FOR UPDATE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can delete subscriptions" ON public.client_subscriptions FOR DELETE
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.client_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and company on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  -- Create company
  INSERT INTO public.companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
  RETURNING id INTO new_company_id;
  
  -- Add user as owner
  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
