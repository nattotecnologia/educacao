-- Atualização de Tabela para Módulo WhatsApp (Evolution API)

-- 1. Adicionamos campos para guardar os dados da Evolution API na Instituição
ALTER TABLE public.institutions
ADD COLUMN IF NOT EXISTS evolution_instance_name text UNIQUE,
ADD COLUMN IF NOT EXISTS evolution_api_key text,
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'disconnected';

-- 2. Atualizamos a tabela de leads para poder atrelar o identificador externo do contato (ex: 5511999999999@s.whatsapp.net)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS remote_jid text;

-- Fim.
