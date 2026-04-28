const fs = require('fs');

function loadEnv() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
  return env;
}

const env = loadEnv();

async function checkWebhook() {
  const url = `${env.EVOLUTION_API_URL}/webhook/find/education`;
  console.log("Checking webhook for instance: education");
  try {
    const res = await fetch(url, {
      headers: { apikey: env.EVOLUTION_GLOBAL_APIKEY }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkWebhook();
