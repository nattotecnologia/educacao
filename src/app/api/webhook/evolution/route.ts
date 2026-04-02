import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const instanceName = payload.instance; 
    
    // Ignora se não houver mensagem ou se a mensagem for enviada pelo próprio número (bot)
    if (!payload.data?.message || payload.data?.key?.fromMe) {
      return NextResponse.json({ success: true, reason: 'ignored' });
    }

    const incomingText = payload.data.message.conversation || payload.data.message.extendedTextMessage?.text || '';
    const phoneRemoteJid = payload.data.key.remoteJid;
    const phoneNumber = phoneRemoteJid.split('@')[0];
    const pushName = payload.data.pushName || 'Lead WhatsApp';

    if (!incomingText) return NextResponse.json({ success: true, reason: 'no_text' });

    // 1. Descobre a Instituição pelas configurações
    const { data: institution, error: instError } = await supabaseAdmin
      .from('institutions')
      .select('*')
      .eq('evolution_instance_name', instanceName)
      .single();

    if (instError || !institution) {
      console.error('Instância não vinculada a nenhuma instituição:', instanceName);
      return NextResponse.json({ error: 'Institution_Not_Found' }, { status: 404 });
    }

    // 2. Registra ou Atualiza o Lead no Banco (CRM)
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .upsert({
        phone: phoneNumber,
        institution_id: institution.id,
        name: pushName,
        status: 'ai_handling' // Por padrão, a IA assume
      }, { onConflict: 'phone,institution_id' })
      .select()
      .single();

    if (leadError) console.error('Erro ao registrar lead:', leadError.message);

    // 3. Procura um Agente de IA "ATIVO"
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_agents')
      .select('id, system_prompt')
      .eq('institution_id', institution.id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ success: true, reason: 'no_active_agent' });
    }

    // 4. Seleção Inteligente de Provedor de IA
    const provider = institution.ai_provider || 'openai';
    
    let apiKey = institution.ai_api_key; // fallback
    let baseURL = institution.ai_base_url || undefined;

    if (provider === 'openai') {
      apiKey = institution.openai_key || process.env.OPENAI_API_KEY;
      baseURL = 'https://api.openai.com/v1';
    } else if (provider === 'groq') {
      apiKey = institution.groq_key || process.env.GROQ_API_KEY;
      baseURL = 'https://api.groq.com/openai/v1';
    } else if (provider === 'openrouter') {
      apiKey = institution.openrouter_key || process.env.OPENROUTER_API_KEY;
      baseURL = 'https://openrouter.ai/api/v1';
    }

    if (!apiKey) {
      console.error('Nenhuma API Key configurada para o provedor:', provider);
      return NextResponse.json({ success: true, reason: 'no_api_key_configured' });
    }

    const customOpenAI = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });

    const aiResponse = await customOpenAI.chat.completions.create({
      model: institution.ai_model || 'gpt-4o', 
      messages: [
        { role: 'system', content: agent.system_prompt },
        { role: 'user', content: incomingText },
      ],
      temperature: 0.7,
    });

    const botMessage = aiResponse.choices[0]?.message?.content || 'Desculpe, tive um erro ao processar.';

    // 5. Devolve a mensagem para o WhatsApp via Evolution API
    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const evoKey = process.env.EVOLUTION_GLOBAL_APIKEY || '';

    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoKey
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: botMessage,
        delay: 1200 // Simula digitação curta
      })
    });

    return NextResponse.json({ success: true, ai_handled: true });
    
  } catch (error: any) {
    console.error('Erro crítico no Webhook:', error.message);
    return NextResponse.json({ error: 'Internal_Server_Error' }, { status: 500 });
  }
}
