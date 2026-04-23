const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
const { OpenAI } = require('openai');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.join('=').trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string' || !encryptedData.includes(':')) return String(encryptedData);
  try {
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = crypto.pbkdf2Sync(Buffer.from(envVars.ENCRYPTION_MASTER_KEY, 'hex'), salt, 10000, 32, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
}

const code = fs.readFileSync('src/app/api/webhook/evolution/route.ts', 'utf8');
const toolsMatch = code.match(/const AGENT_TOOLS[^=]*= (\[[\s\S]*?\]);\n\n/);
if(!toolsMatch) { console.log('tools not found'); process.exit(1); }
const evalStr = 'const tools = ' + toolsMatch[1] + '; return tools;';
const getTools = new Function(evalStr);
const tools = getTools();

async function run() {
  const { data: insts } = await supabase.from('institutions').select('*').eq('id', 'e915b1d7-ec67-4259-975d-e18d3b12b7ff').limit(1);
  const inst = insts[0];
  const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: decrypt(inst.openrouter_key) });
  
  try {
    const res = await openai.chat.completions.create({
      model: inst.ai_model,
      messages: [{ role: 'user', content: 'Oi' }],
      max_tokens: 800,
      tools: tools,
      tool_choice: 'auto'
    });
    console.log('OK', res.choices[0].message.content);
  } catch (err) {
    console.log('ERROR:', err.message);
    if(err.error) console.log(JSON.stringify(err.error, null, 2));
  }
}
run();
