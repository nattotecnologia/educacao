import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/utils/encryption';
import { sendEvolutionMessage } from '@/utils/evolution';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = 'nodejs';
// Vercel serverless functions have a max duration. We'll set this relatively high if possible,
// but our batch logic avoids hitting it anyway.
export const maxDuration = 60; 

export async function GET(request: NextRequest) {
  // Verificação básica de segurança para evitar chamadas indevidas (opcional mas recomendado)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Iniciando processamento de Campanhas...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  try {
    // 1. Busca campanhas agendadas que já podem rodar
    const { data: scheduledCampaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (scheduledCampaigns && scheduledCampaigns.length > 0) {
      const ids = scheduledCampaigns.map(c => c.id);
      await supabase
        .from('campaigns')
        .update({ status: 'running' })
        .in('id', ids);
      console.log(`[Cron] ${ids.length} campanhas passaram para 'running'`);
    }

    // 2. Processa campanhas 'running'
    const { data: runningCampaigns } = await supabase
      .from('campaigns')
      .select('id, institution_id, message_template, batch_size, delay_ms')
      .eq('status', 'running');

    if (!runningCampaigns || runningCampaigns.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhuma campanha em execução' });
    }

    let totalSent = 0;

    for (const campaign of runningCampaigns) {
      // Pega dados da instituição
      const { data: institution } = await supabase
        .from('institutions')
        .select('evolution_instance_name, evolution_api_key, evolution_api_url')
        .eq('id', campaign.institution_id)
        .single();

      if (!institution || !institution.evolution_instance_name) {
        console.error(`[Cron] Instituição inválida para campanha ${campaign.id}`);
        continue;
      }

      const evoUrl = institution.evolution_api_url;
      const evoKey = institution.evolution_api_key ? decrypt(institution.evolution_api_key) : process.env.EVOLUTION_GLOBAL_APIKEY || '';
      
      // Busca logs pendentes desta campanha limitados pelo batch_size
      const { data: pendingLogs } = await supabase
        .from('campaign_logs')
        .select('id, lead_id, leads (phone, name)')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .limit(campaign.batch_size || 20);

      if (!pendingLogs || pendingLogs.length === 0) {
        // Sem pendentes, a campanha acabou!
        await supabase
          .from('campaigns')
          .update({ status: 'completed', completed_at: now })
          .eq('id', campaign.id);
        console.log(`[Cron] Campanha ${campaign.id} concluída!`);
        continue;
      }

      console.log(`[Cron] Enviando lote de ${pendingLogs.length} mensagens para campanha ${campaign.id}...`);

      for (const log of pendingLogs) {
        const lead = log.leads as any;
        if (!lead || !lead.phone) {
          await supabase.from('campaign_logs').update({ status: 'failed', error_log: 'Lead sem telefone' }).eq('id', log.id);
          continue;
        }

        // Formata a mensagem com placeholders
        let text = campaign.message_template;
        text = text.replace(/{nome}/gi, lead.name || 'Cliente');

        // Dispara mensagem
        try {
          await sendEvolutionMessage(
            evoUrl,
            evoKey,
            institution.evolution_instance_name,
            lead.phone,
            text,
            true,
            campaign.delay_ms || 2000
          );

          await supabase.from('campaign_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', log.id);
          totalSent++;
          
          // Aguarda o delay para não ser bloqueado (delay entre mensagens individuais)
          // Mas cuidado: se o delay for muito alto e o batch_size muito grande, vai dar timeout na Vercel.
          // Ex: batch_size=20 * delay=3000ms = 60s (Timeout na Vercel Hobby é 10s, Pro é 60s/300s).
          // Se for Hobby, o batch_size ideal é 3 ou 4.
          if (campaign.delay_ms && campaign.delay_ms > 0) {
             await new Promise(r => setTimeout(r, Math.min(campaign.delay_ms, 5000)));
          }

        } catch (error: any) {
          await supabase.from('campaign_logs').update({ status: 'failed', error_log: error.message }).eq('id', log.id);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Disparos em lote executados. ${totalSent} msgs enviadas.` });

  } catch (error: any) {
    console.error('[Cron] Erro geral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
