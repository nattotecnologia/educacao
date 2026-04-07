-- Índices para otimização de performance
-- Execute este script no Supabase SQL Editor

-- Índices na tabela leads
CREATE INDEX IF NOT EXISTS idx_leads_institution_status ON leads(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_institution_created ON leads(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- Índices na tabela messages
CREATE INDEX IF NOT EXISTS idx_messages_lead_created ON messages(lead_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_institution_created ON messages(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);

-- Índices na tabela ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_institution_status ON ai_agents(institution_id, status);

-- Índices na tabela profiles
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
