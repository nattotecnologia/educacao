export async function sendEvolutionMessage(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  phoneNumber: string,
  text: string,
  enableLineBreaks: boolean,
  delayMs: number
): Promise<void> {
  const baseDelay = Math.max(300, Math.min(delayMs, 5000));
  
  // Garante que o evoUrl nunca fique vazio
  const validEvoUrl = (evoUrl || process.env.EVOLUTION_API_URL || 'https://evo.nattotecnologia.cloud').replace(/\/$/, '');

  try {
    if (enableLineBreaks) {
      const parts = text
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean);

      for (let i = 0; i < parts.length; i++) {
        await fetch(`${validEvoUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: phoneNumber, text: parts[i], delay: i === 0 ? 1200 : baseDelay }),
        });

        if (i < parts.length - 1) {
          await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
    } else {
      await fetch(`${validEvoUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: phoneNumber, text, delay: 1200 }),
      });
    }
  } catch (error) {
    console.error('[Evolution API] Erro ao enviar mensagem:', error);
  }
}
