const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cbrqazorztbpnxwiytdb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzODE5NiwiZXhwIjoyMDkwNzE0MTk2fQ._jRGbPc6m0jXGhFpT8vLTLvayuyXFWM1-IAHKPOdroE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
  console.log('--- Iniciando Correção de Leads ---');

  // 1. Buscar todos os agentes ativos
  const { data: agents, error: agentsErr } = await supabase
    .from('ai_agents')
    .select('id, institution_id, is_default')
    .eq('status', 'active');

  if (agentsErr) {
    console.error('Erro ao buscar agentes:', agentsErr);
    return;
  }

  console.log(`Encontrados ${agents.length} agentes ativos.`);

  // 2. Mapear o melhor agente para cada instituição (preferencialmente o default)
  const instToAgent = {};
  for (const agent of agents) {
    if (!instToAgent[agent.institution_id] || agent.is_default) {
      instToAgent[agent.institution_id] = agent.id;
    }
  }

  // 3. Atualizar leads que não possuem ai_agent_id
  let totalUpdated = 0;
  for (const [instId, agentId] of Object.entries(instToAgent)) {
    console.log(`Processando instituição ${instId} com agente ${agentId}...`);
    
    const { data: updated, error: updateErr, count } = await supabase
      .from('leads')
      .update({ ai_agent_id: agentId })
      .eq('institution_id', instId)
      .is('ai_agent_id', null)
      .select('id');

    if (updateErr) {
      console.error(`Erro ao atualizar leads da inst ${instId}:`, updateErr);
    } else {
      console.log(`Atualizados ${updated?.length || 0} leads.`);
      totalUpdated += updated?.length || 0;
    }
  }

  console.log(`\n--- Concluído! Total de leads atualizados: ${totalUpdated} ---`);
}

runFix();
