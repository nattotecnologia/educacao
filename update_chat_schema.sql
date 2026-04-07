-- update_chat_schema.sql
-- Módulo de Chat Híbrido

-- 1. Cria a tabela de mensagens conectada ao lead
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  institution_id uuid references public.institutions(id) on delete cascade not null,
  direction text not null check (direction in ('inbound', 'outbound_ai', 'outbound_human')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. RLS e Políticas
ALTER TABLE public.messages enable row level security;

-- Política de Leitura (Agentes e Admins da mesma instituição podem ver as mensagens)
CREATE POLICY "Users can view their institution messages"
  on public.messages for select
  using (institution_id = (select institution_id from public.profiles where id = auth.uid()));

-- Política de Inserção (necessário para quando o humano manda uma mensagem pelo painel)
CREATE POLICY "Users can insert institution messages"
  on public.messages for insert
  with check (institution_id = (select institution_id from public.profiles where id = auth.uid()));
