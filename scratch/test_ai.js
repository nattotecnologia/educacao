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

async function run() {
  const { data: insts } = await supabase.from('institutions').select('*').eq('id', 'e915b1d7-ec67-4259-975d-e18d3b12b7ff').limit(1);
  const institution = insts[0];
  console.log('Institution:', institution.id);
  console.log('Provider:', institution.ai_provider);
  console.log('Model:', institution.ai_model);

  const decryptedKey = decrypt(institution.openrouter_key);
  console.log('Decrypted OpenRouter Key:', decryptedKey ? (decryptedKey.substring(0, 15) + '...') : 'FAILED');

  const evoKey = decrypt(institution.evolution_api_key) || envVars.EVOLUTION_GLOBAL_APIKEY || '';
  console.log('Decrypted Evolution Key:', evoKey.substring(0, 15) + '...');

  if (decryptedKey) {
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: decryptedKey,
    });
    try {
      const res = await openai.chat.completions.create({
        model: institution.ai_model,
        messages: [{ role: 'user', content: 'Oi' }],
        max_tokens: 800,
        tools: [{ type: 'function', function: { name: 'test', description: 'test', parameters: { type: 'object', properties: {} } } }]
      });
      console.log('AI Response:', res.choices[0].message.content);
    } catch (err) {
      console.log('AI Error:', err.message);
      if (err.error) console.log('Details:', JSON.stringify(err.error, null, 2));
    }
  }
}

run();
