/**
 * Script utilitário para configurar o Webhook na Evolution API
 * Executar via: node setup-webhook.mjs <SUA_URL_PUBLICA>
 */

const EVO_URL = process.env.EVOLUTION_API_URL || "https://evo.nattotecnologia.cloud";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "education";
const API_KEY = process.env.EVOLUTION_INSTANCE_TOKEN || "FFB66FA54123-48D8-80A1-8BEB91EE0E44";

let webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error("🚨 ERRO: Por favor, forneça a URL do seu ngrok/dominio como argumento.");
  console.error("Exemplo: node setup-webhook.mjs https://1234-abcd.ngrok-free.app/api/webhook/evolution");
  process.exit(1);
}

// Ensure the webhook URL ends with /api/webhook/evolution
if (!webhookUrl.includes('/api/webhook/evolution')) {
  webhookUrl = webhookUrl.replace(/\/$/, '') + '/api/webhook/evolution';
}

async function setWebhook() {
  const endpoint = `${EVO_URL.replace(/\/$/, '')}/webhook/set/${INSTANCE_NAME}`;
  
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ["MESSAGES_UPSERT"]
    }
  };

  try {
    console.log(`\n⚙️ Configurando webhook na instância [${INSTANCE_NAME}]...`);
    console.log(`🔗 URL Destino: ${webhookUrl}\n`);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        const txt = await res.text();
        console.error("❌ Erro na API da Evolution:", res.status, txt);
    } else {
        const data = await res.json();
        console.log("✅ Webhook configurado com sucesso!");
        console.log("Retorno da API:", data);
    }
  } catch (err) {
    console.error("❌ Falha na comunicação:", err.message);
  }
}

setWebhook();
