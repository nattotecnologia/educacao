-- Adiciona configurações de IA na Instituição para suporte a Groq, OpenRouter, etc.

ALTER TABLE public.institutions
ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS ai_api_key text,
ADD COLUMN IF NOT EXISTS ai_model text DEFAULT 'gpt-4o',
ADD COLUMN IF NOT EXISTS ai_base_url text;

-- Exemplo de uso para Groq: 
-- ai_provider: 'groq'
-- ai_base_url: 'https://api.groq.com/openai/v1'
-- ai_model: 'llama3-70b-8192'
