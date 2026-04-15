const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log("Recent messages:");
  messages.forEach(m => console.log(`[${m.direction}] ${m.content}`));
  
  const { data: visits } = await supabase
    .from('visit_appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("\nRecent visits:");
  console.log(JSON.stringify(visits, null, 2));
}

main().catch(console.error);
