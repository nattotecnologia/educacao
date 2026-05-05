import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { name, modality } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          {
            role: 'system',
            content: 'Voce e um assistente de IA especialista em marketing educacional. Gere uma descricao curta, profissional e altamente atrativa (maximo de 3 frases) para um curso ou turma com base no nome fornecido. Escreva em portugues do Brasil, de forma direta, sem introducoes.'
          },
          {
            role: 'user',
            content: `Gere a descricao para: "${name}" (${modality || 'Presencial'}).`
          }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ description });
  } catch (err: any) {
    console.error('Erro ao gerar descricao:', err);
    return NextResponse.json({ error: 'Erro ao gerar descricao com IA.' }, { status: 500 });
  }
}
