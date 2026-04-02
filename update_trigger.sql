-- Arquivo: update_trigger.sql
-- Função para criar Instituição e Perfil automaticamente no cadastro

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_inst_id uuid;
  inst_name text;
begin
  -- Pega o nome da instituição dos metadados do usuário (passado no signUp)
  inst_name := new.raw_user_meta_data->>'institution_name';
  
  -- Se houver um nome de instituição, cria a instituição e define o usuário como admin
  if inst_name is not null then
    insert into public.institutions (name)
    values (inst_name)
    returning id into new_inst_id;
    
    insert into public.profiles (id, institution_id, full_name, role)
    values (new.id, new_inst_id, new.raw_user_meta_data->>'full_name', 'admin');
  else
    -- Caso contrário, cria apenas o perfil com papel de agente (vendedor)
    insert into public.profiles (id, full_name, role)
    values (new.id, new.raw_user_meta_data->>'full_name', 'agent');
  end if;
  
  return new;
end;
$$ language plpgsql security definer;
