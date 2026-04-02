-- Arquivo: fix_orphan_users.sql
-- ESTA VERSÃO É MAIS AGRESSIVA PARA GARANTIR O ACESSO

DO $$
DECLARE
  rec_user RECORD;
  new_inst_id UUID;
BEGIN
  -- 1. Garante que TODO usuário do Auth tenha um Perfil (independente de role)
  INSERT INTO public.profiles (id, full_name, role)
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'Usuário ' || substr(id::text, 1, 4)), 'admin'
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Garante que TODO perfil sem instituição receba uma (independente de role ser agent ou admin)
  FOR rec_user IN 
    SELECT p.id, u.raw_user_meta_data 
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.institution_id IS NULL
  LOOP
    -- Criamos uma instituição para ele
    INSERT INTO public.institutions (name)
    VALUES (COALESCE(rec_user.raw_user_meta_data->>'institution_name', 'Escola de Teste ' || substr(rec_user.id::text, 1, 4)))
    RETURNING id INTO new_inst_id;
    
    -- Vinculamos e garantimos que ele seja ADMIN para poder configurar as chaves
    UPDATE public.profiles 
    SET institution_id = new_inst_id, role = 'admin' 
    WHERE id = rec_user.id;
  END LOOP;

END $$;
