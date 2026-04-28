const payload = {
  event: 'messages.upsert',
  instanceId: 'f6f9f56f-df67-4ac5-b725-e89a970ef962',
  data: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'TESTE-NODE-' + Date.now()
    },
    pushName: 'Edson Teste',
    message: {
      conversation: 'Olá, teste manual via node'
    },
    messageType: 'conversation'
  }
};

async function test() {
  console.log("Sending manual webhook to Vercel...");
  try {
    const res = await fetch('https://educacao-flame.vercel.app/api/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
}

test();
