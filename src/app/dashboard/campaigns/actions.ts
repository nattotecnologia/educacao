'use server'

import { createClient } from "@/utils/supabase/server";

export async function getCampaigns() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) return [];

  const { data, error } = await supabase
    .from('campaigns')
    .select('*, promotions(name)')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar campanhas:', error);
    return [];
  }

  return data;
}

export async function getLeadsForCampaign() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, status')
    .eq('institution_id', profile.institution_id);

  if (error) {
    console.error('Erro ao buscar leads:', error);
    return [];
  }

  return data;
}

export async function getActivePromotions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) return [];

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('promotions')
    .select('id, name, description, valid_until')
    .eq('institution_id', profile.institution_id)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${now}`);

  if (error) return [];
  return data;
}

export async function createCampaign(data: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) throw new Error("Instituição não encontrada");

  // 1. Cria a campanha
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      institution_id: profile.institution_id,
      name: data.name,
      type: 'promotion',
      status: data.scheduled_at ? 'scheduled' : 'running',
      scheduled_at: data.scheduled_at || null,
      message_template: data.message_template,
      promotion_id: data.promotion_id || null,
      target_audience: data.target_audience,
      batch_size: data.batch_size || 20,
      delay_ms: data.delay_ms || 2000,
    })
    .select()
    .single();

  if (campaignError) throw campaignError;

  // 2. Resolve os Leads
  let leadIdsToTarget: string[] = [];
  if (data.target_audience.type === 'all') {
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('institution_id', profile.institution_id);
    if (leads) leadIdsToTarget = leads.map(l => l.id);
  } else {
    leadIdsToTarget = data.target_audience.lead_ids || [];
  }

  // 3. Insere logs pendentes
  if (leadIdsToTarget.length > 0) {
    const logsToInsert = leadIdsToTarget.map(lead_id => ({
      campaign_id: campaign.id,
      lead_id,
      status: 'pending'
    }));

    // Insert em lotes para evitar erro se houver milhares
    const chunkSize = 1000;
    for (let i = 0; i < logsToInsert.length; i += chunkSize) {
      const chunk = logsToInsert.slice(i, i + chunkSize);
      await supabase.from('campaign_logs').insert(chunk);
    }
  } else {
    // Se não há leads, a campanha já nasce concluída
    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id);
  }

  return { success: true, campaign };
}

export async function getRemindersSettings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) return null;

  const { data } = await supabase
    .from('institutions')
    .select('visit_reminder_minutes, visit_reminder_message')
    .eq('id', profile.institution_id)
    .single();

  return data;
}

export async function updateRemindersSettings(minutes: number, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) throw new Error("Instituição não encontrada");

  const { error } = await supabase
    .from('institutions')
    .update({ 
      visit_reminder_minutes: minutes,
      visit_reminder_message: message
    })
    .eq('id', profile.institution_id);

  if (error) throw error;
  return { success: true };
}
