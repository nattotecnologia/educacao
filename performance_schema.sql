-- Script de Otimização de Performance de BD
-- Execute este script no SQL Editor do seu projeto Supabase

-- O Dashboard e o Kanban fazem varredura pesada (Seq Scan) nos leads.
-- Precisamos destes índices B-Tree para que a filtragem por instituição e status corra em <50ms.

-- 1. Index para Busca de Leads por Instituição (Usado no Middleware/RLS e Dashboard Geral)
CREATE INDEX IF NOT EXISTS idx_leads_institution_id 
ON public.leads USING btree (institution_id);

-- 2. Index Composto (Instituity + Status + Created_At)
-- Crucial para a Dashboard (Visualização de Funil e Gráficos de Conversão do pipeline)
CREATE INDEX IF NOT EXISTS idx_leads_dashboard_stats 
ON public.leads USING btree (institution_id, status, created_at DESC);

-- 3. Index para Busca Textual Rápida (Lista de Chat)
-- Facilita buscar clientes pelo telefone ou nome sem varrer toda a tabela
-- Isso também atende as APIs que pesquisam se o telefone já existe
CREATE INDEX IF NOT EXISTS idx_leads_metrics 
ON public.leads USING btree (institution_id, phone);

-- 4. Index para Agentes de IA
-- Ajuda a rota do webhooks a identificar rápido o agente
CREATE INDEX IF NOT EXISTS idx_ai_agents_institution 
ON public.ai_agents USING btree (institution_id, status);

-- [Bônus de Segurança] - Garantir que o Dashboard da escola A nunca trave fazendo COUNT na escola B.
-- Apenas para ter certeza de que o Query Planner priorize os blocos da instituição correta.
ANALYZE public.leads;
ANALYZE public.ai_agents;
