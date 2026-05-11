import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/utils/encryption';
import { sendEvolutionMessage } from '@/utils/evolution';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = 'nodejs';
export const maxDuration = 60; 

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Iniciando processamento de Lembretes de Visita...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowBrtStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T');
  const now = new Date(nowBrtStr + 'Z'); // Alinha o Agora do servidor ao fuso fictício "UTC-Ingênuo" gravado no banco

  try {
    // 1. Busca instituições com lembretes ativos
    // Vamos buscar todas as visitas marcadas que estão próximas, com JOIN na instituição
    const { data: visits } = await supabase
      .from('visit_appointments')
      .select('id, lead_id, lead_phone, lead_name, scheduled_at, institution_id, institutions(visit_reminder_minutes, visit_reminder_message, visit_reminder_active, name, evolution_instance_name, evolution_api_key)')
      .eq('status', 'scheduled')
      .is('reminder_sent_at', null)
      .gt('scheduled_at', now.toISOString()); // Filtra visitas no futuro

    if (!visits || visits.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhuma visita aguardando lembrete' });
    }

    let sentCount = 0;

    for (const visit of visits) {
      const institution = visit.institutions as any;
      if (!institution || !institution.evolution_instance_name) continue;
      if (institution.visit_reminder_active === false) continue; // Pula se os lembretes estão desativados nesta instituição

      const minutesBefore = institution.visit_reminder_minutes || 120;
      
      // Verifica se já está na hora de enviar o lembrete
      const visitTime = new Date(visit.scheduled_at);
      const reminderTime = new Date(visitTime.getTime() - (minutesBefore * 60 * 1000));

      if (now >= reminderTime) {
        // Enviar lembrete!
        console.log(`[Cron] Enviando lembrete para visita ${visit.id} (Lead: ${visit.lead_name})`);

        let template = institution.visit_reminder_message;
        if (!template || template.trim() === '') {
          template = `Olá {nome}! Passando para lembrar da sua visita agendada conosco hoje às {horario} na {instituicao}! Te esperamos!`;
        }

        // Formata data
        const localTime = visit.scheduled_at.substring(11, 16);

        const text = template
          .replace(/{nome}/gi, visit.lead_name || 'Visitante')
          .replace(/{horario}/gi, localTime)
          .replace(/{instituicao}/gi, institution.name || 'nossa instituição');

        const evoUrl = institution.evolution_api_url; // will be undefined, which falls back properly
        const evoKey = institution.evolution_api_key ? decrypt(institution.evolution_api_key) : process.env.EVOLUTION_GLOBAL_APIKEY || '';

        try {
          await sendEvolutionMessage(
            evoUrl,
            evoKey,
            institution.evolution_instance_name,
            visit.lead_phone,
            text,
            false,
            1200
          );

          await supabase
            .from('visit_appointments')
            .update({ reminder_sent_at: now.toISOString() })
            .eq('id', visit.id);
            
          sentCount++;
        } catch (error) {
          console.error(`[Cron] Erro ao enviar lembrete da visita ${visit.id}:`, error);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Processamento concluído. ${sentCount} lembretes enviados.` });

  } catch (error: any) {
    console.error('[Cron] Erro geral (lembretes):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
