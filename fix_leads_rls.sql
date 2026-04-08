-- Execute este script no SQL Editor do seu projeto Supabase para corrigir a exclusão de leads
-- Encontre em: https://supabase.com/dashboard/project/_/sql

-- Adicionando política de deleção para Leads baseada na instituição do usuário
CREATE POLICY "Users can delete their institution leads"
ON public.leads
FOR DELETE
USING (institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- Verificação: Garante que as estatísticas do Dashboard funcionem com a Service Role Key
-- (O Dashboard já usa a service_role_key para ignorar estas políticas ao somar totais)
