import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- CAMPAIGNS ---');
  const { data: camps } = await supabase.from('campaigns').select('id, name, status, created_at');
  console.log(camps);

  console.log('\n--- CAMPAIGN LOGS ---');
  const { data: logs } = await supabase.from('campaign_logs').select('id, status, error_log').limit(10);
  console.log(logs);

  console.log('\n--- VISITS ---');
  const { data: visits } = await supabase.from('visit_appointments').select('id, lead_name, scheduled_at, status, reminder_sent_at').eq('status', 'scheduled');
  console.log(visits);
}

main();
