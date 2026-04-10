-- ============================================================
-- Migration: ai_agents v2 — Adiciona campos avançados de config
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- ============================================================

-- Papel do Agente
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS agent_role text DEFAULT 'custom'
    CHECK (agent_role IN ('reception', 'sdr', 'followup', 'support', 'custom'));

-- Estilo de Comunicação
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS communication_style text DEFAULT 'whatsapp'
    CHECK (communication_style IN ('default', 'whatsapp', 'casual', 'formal'));

-- Configurações de comportamento da IA
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS temperature numeric(3,1) DEFAULT 0.7;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_tokens integer DEFAULT 500;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS ai_model_override text;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS max_history_messages integer DEFAULT 10;

-- Mensagens especiais
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS greeting_message text;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS fallback_message text;

-- Controle de formatação de resposta
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS enable_line_breaks boolean DEFAULT false;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS response_delay_ms integer DEFAULT 800;

-- Agente padrão da instituição
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- ============================================================
-- Verifica o resultado final
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ai_agents'
  AND table_schema = 'public'
ORDER BY ordinal_position;
