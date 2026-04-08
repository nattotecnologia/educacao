-- Criação da Tabela de Configurações Globais da Plataforma (Platform Branding/Settings)
-- Execute este script no SQL Editor do seu projeto Supabase

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Força ser uma única linha global
    primary_color text DEFAULT '#3b82f6',
    logo_light_url text,
    logo_dark_url text,
    favicon_light_url text,
    favicon_dark_url text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ativa o RLS (Row Level Security) mas permite LEITURA PÚBLICA (essencial para cor na tela de login)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view platform settings" 
ON public.platform_settings FOR SELECT USING (true);

-- Permite UPDATE apenas para usuários com role de admin
CREATE POLICY "Admins can update platform settings" 
ON public.platform_settings FOR UPDATE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert platform settings" 
ON public.platform_settings FOR INSERT 
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Inserindo um valor default de inicialização para não dar array vazio na API
INSERT INTO public.platform_settings (id, primary_color) 
VALUES (1, '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- Criação do Bucket de Storage para abrigar a logo/arquivos institucionais
-- Observação: Esse comando costuma não rodar direto dependendo das permissões do Dashboard
-- Caso falhe a criação do Bucket pelo SQL, crie o bucket manualmente "brand-assets" configurado como "Public" no Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage para garantir o upload restrito e leitura pública
CREATE POLICY "Imagens públicas para visualização"
ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');

CREATE POLICY "Apenas usuários logados podem fazer upload de assets"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Apenas usuários logados podem atualizar assets"
ON storage.objects FOR UPDATE 
USING (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');
