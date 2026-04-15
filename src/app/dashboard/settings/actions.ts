'use server'

import { createClient } from "@/utils/supabase/server";
import { encrypt, decrypt } from "@/utils/encryption";

export async function getInstitutionSettings() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Não autorizado");

    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (!profile?.institution_id) return null;

    const { data: inst } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', profile.institution_id)
      .single();

    if (!inst) return null;

    // Descriptografar as chaves no servidor antes de enviar para o cliente preencher o formulário
    return {
      ...inst,
      openai_key: inst.openai_key ? decrypt(inst.openai_key) : '',
      groq_key: inst.groq_key ? decrypt(inst.groq_key) : '',
      openrouter_key: inst.openrouter_key ? decrypt(inst.openrouter_key) : '',
      ai_api_key: inst.ai_api_key ? decrypt(inst.ai_api_key) : '',
      evolution_api_key: inst.evolution_api_key ? decrypt(inst.evolution_api_key) : '',
    };
  } catch (error) {
    console.error('Erro em getInstitutionSettings:', error);
    throw error;
  }
}

export async function updateInstitutionSettings(data: any) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Não autorizado");

    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (!profile?.institution_id) throw new Error("Instituição não encontrada");

    // Somente as chaves são criptografadas antes de salvar
    const { error } = await supabase
      .from('institutions')
      .update({
        name: data.name,
        ai_provider: data.ai_provider,
        ai_api_key: data.ai_api_key ? encrypt(data.ai_api_key) : null,
        openai_key: data.openai_key ? encrypt(data.openai_key) : null,
        groq_key: data.groq_key ? encrypt(data.groq_key) : null,
        openrouter_key: data.openrouter_key ? encrypt(data.openrouter_key) : null,
        ai_model: data.ai_model,
        ai_base_url: data.ai_base_url,
        evolution_instance_name: data.evolution_instance_name,
        evolution_api_key: data.evolution_api_key ? encrypt(data.evolution_api_key) : null,
      })
      .eq('id', profile.institution_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro em updateInstitutionSettings:', error);
    throw error;
  }
}

export async function updateTokenQuota(quota: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { data: profile } = await supabase
      .from('profiles')
      .select('institution_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.institution_id) throw new Error("Instituição não encontrada");
    if (profile.role !== 'admin') throw new Error("Apenas administradores podem alterar a cota.");

    const { error } = await supabase
      .from('institutions')
      .update({ ai_token_quota: quota })
      .eq('id', profile.institution_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro em updateTokenQuota:', error);
    throw error;
  }
}

export async function getPlatformSettings() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
    return data;
  } catch (error) {
    console.error('Erro em getPlatformSettings:', error);
    return null;
  }
}

export async function updatePlatformSettings(data: any) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { error } = await supabase
      .from('platform_settings')
      .update({
        primary_color: data.primary_color,
        logo_light_url: data.logo_light_url,
        logo_dark_url: data.logo_dark_url,
        favicon_light_url: data.favicon_light_url,
        favicon_dark_url: data.favicon_dark_url,
      })
      .eq('id', 1);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro em updatePlatformSettings:', error);
    throw error;
  }
}
