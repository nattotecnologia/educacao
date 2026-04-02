-- Schema Inicial: Educacao SaaS AI
-- Arquitetura Multitenant + Funcionalidades de CRM

-- Habilitar a extensão para gerador de UUID
create extension if not exists "uuid-ossp";

-------------------------------------------------------------------------
-- 1. INSTITUTIONS (Tenants)
-------------------------------------------------------------------------
create table public.institutions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativando RLS
alter table public.institutions enable row level security;

-- Política RLS temporariamente aberta (Ajustar em produção)
create policy "Institutions are viewable by everyone" 
  on public.institutions for select using (true);

-------------------------------------------------------------------------
-- 2. PROFILES (Extensão de auth.users)
-------------------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  institution_id uuid references public.institutions(id) on delete restrict,
  full_name text,
  role text check (role in ('admin', 'agent')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Cada um pode ver profiles da própria instituição
create policy "Users can view profiles on same institution" 
  on public.profiles for select 
  using (
    auth.uid() = id OR 
    institution_id = (select institution_id from public.profiles where id = auth.uid())
  );

-- O usuário gerencia seu próprio profile
create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-------------------------------------------------------------------------
-- 3. AI AGENTS (Agentes configurados por tenant)
-------------------------------------------------------------------------
create table public.ai_agents (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade not null,
  name text not null,
  system_prompt text,
  status text default 'inactive' check (status in ('active', 'inactive', 'training')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_agents enable row level security;

-- Visualização limitada à instituição do agente
create policy "Users can view their institution agents"
  on public.ai_agents for select
  using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

create policy "Admins can insert/update agents"
  on public.ai_agents for all
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin' AND
    institution_id = (select institution_id from public.profiles where id = auth.uid())
  );

-------------------------------------------------------------------------
-- 4. LEADS (Contatos do WhatsApp)
-------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade not null,
  ai_agent_id uuid references public.ai_agents(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null, -- humano que assumiu
  name text,
  phone text not null,
  status text default 'new' check (status in ('new', 'ai_handling', 'human_handling', 'converted', 'lost')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (institution_id, phone) -- não repetir phone na mesma instituição
);

alter table public.leads enable row level security;

-- Permissões para membros da instituição visualizarem os leads
create policy "Users can view their institution leads"
  on public.leads for select
  using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

-- Update de leads por membros da mesma instituição
create policy "Users can update their institution leads"
  on public.leads for update
  using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

create policy "Users can insert leads"
  on public.leads for insert
  with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));

-------------------------------------------------------------------------
-- TRIGGERS PARA UPDATED_AT
-------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_institution_updated
  before update on public.institutions
  for each row execute procedure handle_updated_at();

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure handle_updated_at();

create trigger on_ai_agent_updated
  before update on public.ai_agents
  for each row execute procedure handle_updated_at();

create trigger on_lead_updated
  before update on public.leads
  for each row execute procedure handle_updated_at();

-------------------------------------------------------------------------
-- TRIGGER: Auto-criar Profile ao criar User na tabela Auth
-------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Obs: em SaaS real, você costuma atrelar novos orgs.
  -- Para este exemplo, definiremos manual depois ou via app login default
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'agent');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
