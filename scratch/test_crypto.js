const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

// Load env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.join('=').trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 10000;

function getMasterKey() {
  const key = envVars.ENCRYPTION_MASTER_KEY;
  if (!key) throw new Error('ENCRYPTION_MASTER_KEY missing');
  return Buffer.from(key, 'hex');
}

function deriveKey(salt) {
  return crypto.pbkdf2Sync(getMasterKey(), salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string' || !encryptedData.includes(':')) return String(encryptedData);
  try {
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return 'DECRYPTION_FAILED: ' + error.message;
  }
}

async function run() {
  const { data } = await supabase.from('institutions').select('id, evolution_api_key, openrouter_key');
  for (const inst of data) {
    console.log(`Institution ${inst.id}`);
    console.log(`OpenRouter Key: ${decrypt(inst.openrouter_key).substring(0, 50)}...`);
    console.log(`Evolution Key: ${decrypt(inst.evolution_api_key).substring(0, 50)}...`);
  }
}

run();
