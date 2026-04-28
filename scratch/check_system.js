const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    });
    return env;
  } catch (e) {
    return process.env;
  }
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- Institutions ---");
  const { data: insts } = await supabase
    .from('institutions')
    .select('id, name, evolution_instance_name, whatsapp_status, ai_provider, ai_model, ai_api_key');
  console.log(JSON.stringify(insts, null, 2));

  console.log("\n--- Active Agents ---");
  const { data: agents } = await supabase
    .from('ai_agents')
    .select('id, name, status, is_default, ai_model_override, max_tokens, fallback_message');
  console.log(JSON.stringify(agents, null, 2));

  console.log("\n--- Recent Failures ---");
  const { data: failures } = await supabase
    .from('messages')
    .select('direction, content, created_at')
    .eq('direction', 'outbound_ai')
    .ilike('content', '%atendente irá te ajudar%')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(failures, null, 2));
}

main().catch(console.error);
