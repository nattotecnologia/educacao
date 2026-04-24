const { fetch } = require('undici'); // or built-in
fetch('https://cbrqazorztbpnxwiytdb.supabase.co/rest/v1/messages?select=direction,content,created_at,institution_id&order=created_at.desc&limit=15', {
  headers: {
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzgxOTYsImV4cCI6MjA5MDcxNDE5Nn0.W6c1Nyv5UfM7iZ2qFPQm7LqgXju-kxUKr3pXxwJgWbY',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzODE5NiwiZXhwIjoyMDkwNzE0MTk2fQ._jRGbPc6m0jXGhFpT8vLTLvayuyXFWM1-IAHKPOdroE'
  }
}).then(r => r.json()).then(d => {
  console.log('MESSAGES:');
  d.forEach(m => console.log(`[${m.created_at}] [${m.direction}] [Inst:${m.institution_id}] ${m.content.substring(0,50)}`));
}).catch(console.error);

fetch('https://cbrqazorztbpnxwiytdb.supabase.co/rest/v1/institutions?select=id,name,ai_provider,evolution_instance_name,whatsapp_status', {
  headers: {
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzgxOTYsImV4cCI6MjA5MDcxNDE5Nn0.W6c1Nyv5UfM7iZ2qFPQm7LqgXju-kxUKr3pXxwJgWbY',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzODE5NiwiZXhwIjoyMDkwNzE0MTk2fQ._jRGbPc6m0jXGhFpT8vLTLvayuyXFWM1-IAHKPOdroE'
  }
}).then(r => r.json()).then(d => {
  console.log('\nINSTITUTIONS:');
  console.log(JSON.stringify(d, null, 2));
}).catch(console.error);
