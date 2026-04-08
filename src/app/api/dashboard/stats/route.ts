import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ AVISO: SUPABASE_SERVICE_ROLE_KEY não encontrada. O Dashboard pode exibir zeros por causa do RLS.');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get('institution_id');

    if (!institutionId) {
      return NextResponse.json({ error: 'institution_id obrigatório' }, { status: 400 });
    }

    // Busca todos os leads da instituição
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, status, created_at, name, phone, ai_agent_id')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (leadsError) throw leadsError;

    const allLeads = leads || [];
    const total = allLeads.length;
    const converted = allLeads.filter(l => l.status === 'converted').length;
    const aiHandling = allLeads.filter(l => l.status === 'ai_handling').length;
    const newLeads = allLeads.filter(l => l.status === 'new').length;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    // Agrupa leads por dia da semana (últimos 7 dias)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weeklyData: Record<string, { ai: number; human: number }> = {};

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      weeklyData[dayName] = { ai: 0, human: 0 };
    }

    allLeads.forEach(lead => {
      const d = new Date(lead.created_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo <= 6) {
        const dayName = days[d.getDay()];
        if (weeklyData[dayName]) {
          if (lead.ai_agent_id || lead.status === 'ai_handling') {
            weeklyData[dayName].ai += 1;
          } else {
            weeklyData[dayName].human += 1;
          }
        }
      }
    });

    const weeklyChart = Object.entries(weeklyData).map(([name, vals]) => ({
      name,
      ...vals,
    }));

    // Busca contagem de agentes ativos
    const { count: activeAgents } = await supabaseAdmin
      .from('ai_agents')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .eq('status', 'active');

    // Últimos 5 leads para o feed
    const recentLeads = allLeads.slice(0, 5);

    return NextResponse.json({
      total,
      converted,
      conversionRate,
      aiHandling,
      newLeads,
      activeAgents: activeAgents || 0,
      weeklyChart,
      recentLeads,
    });
  } catch (err: any) {
    console.error('Erro nas stats:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
