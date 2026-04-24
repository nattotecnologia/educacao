const OpenAI = require('openai');
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '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'
});

async function main() {
  try {
    const systemPrompt = "A".repeat(1500); // simulate 500+ tokens
    const aiResponse = await openai.chat.completions.create({
      model: 'openai/gpt-4o', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Olá, tudo bem?' }
      ],
      max_tokens: 800
    });
    console.log('AI Response:', aiResponse.choices[0].message.content);
  } catch (error) {
    console.error('AI Error:', error.message);
  }
}
main();
