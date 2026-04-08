-------------------------------------------------------------------------
-- UPDATE KANBAN SCHEMA: PIPELINES E ESTAGIOS
-------------------------------------------------------------------------

-- 1. Tabela PIPELINES
create table if not exists public.pipelines (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.pipelines enable row level security;

drop policy if exists "Users can view their institution pipelines" on public.pipelines;
create policy "Users can view their institution pipelines" on public.pipelines for select using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

drop policy if exists "Institutions can manage pipelines" on public.pipelines;
create policy "Institutions can manage pipelines" on public.pipelines for all using (institution_id = (select institution_id from public.profiles where id = auth.uid()));


-- 2. Tabela PIPELINE_STAGES
create table if not exists public.pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  name text not null,
  color text default '#3b82f6',
  "order" integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.pipeline_stages enable row level security;

drop policy if exists "Users can view their institution stages" on public.pipeline_stages;
create policy "Users can view their institution stages" on public.pipeline_stages for select using (
  pipeline_id in (select id from public.pipelines where institution_id = (select institution_id from public.profiles where id = auth.uid()))
);

drop policy if exists "Institutions can manage stages" on public.pipeline_stages;
create policy "Institutions can manage stages" on public.pipeline_stages for all using (
  pipeline_id in (select id from public.pipelines where institution_id = (select institution_id from public.profiles where id = auth.uid()))
);


-- 3. Atualizar Tabela LEADS
alter table public.leads add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null;
alter table public.leads add column if not exists stage_id uuid references public.pipeline_stages(id) on delete set null;
alter table public.leads add column if not exists stage_order double precision default 0;

-- 4. Triggers de Updated_At
create trigger on_pipeline_updated
  before update on public.pipelines
  for each row execute procedure handle_updated_at();

create trigger on_stage_updated
  before update on public.pipeline_stages
  for each row execute procedure handle_updated_at();

-- -- Inserir um pipeline padrao para instituicoes existentes? (Opcional, faremos via API dps)
