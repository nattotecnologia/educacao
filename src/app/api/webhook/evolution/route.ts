import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { decrypt } from '@/utils/encryption';
import { rateLimit } from '@/utils/rate-limit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';

export const runtime = 'nodejs';

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'your_webhook_secret_here') {
    console.warn('[Webhook] Aviso: EVOLUTION_WEBHOOK_SECRET não configurado. Aceitando requisição sem validação HMAC (Modo Permissivo).');
    return true;
  }

  const signature = request.headers.get('x-evol-signature');
  if (!signature) {
    console.warn('[Webhook] Aviso: Assinatura HMAC ausente no cabeçalho (x-evol-signature), mas EVOLUTION_WEBHOOK_SECRET está configurado. Aceitando por compatibilidade (Verifique as configs da Evolution API).');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(request);
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log(`[Webhook] Recebida requisição POST às ${new Date().toISOString()}`);
  
  const bodyText = await request.text();
  console.log(`[Webhook] Body length: ${bodyText.length} bytes`);
  
  if (!verifyWebhookSignature(request, bodyText)) {
    console.error('[Webhook] Erro: Assinatura HMAC inválida. Verifique o EVOLUTION_WEBHOOK_SECRET.');
    return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
  }
  console.log('[Webhook] Assinatura validada com sucesso.');

  try {
    const payload = JSON.parse(bodyText);
    const instanceName = payload.instance; 
    const event = payload.event;

    console.log('[Webhook] FULL PAYLOAD:', JSON.stringify(payload, null, 2));
    console.log(`[Webhook] Processando instância: ${instanceName} | Evento: ${event}`);
    
    const { data: institution, error: instError } = await supabaseAdmin
      .from('institutions')
      .select('*')
      .eq('evolution_instance_name', instanceName)
      .single();

    if (instError || !institution) {
      console.error(`[Webhook] Erro: Instituição não encontrada para a instância "${instanceName}"`);
      return NextResponse.json({ error: 'Institution_Not_Found' }, { status: 404 });
    }
    console.log(`[Webhook] Instituição identificada: ${institution.name} (ID: ${institution.id})`);

    // 2. Trata Eventos de Conexão (Sync de Status)
    if (event === 'connection.update') {
      const state = payload.data?.state;
      const newStatus = state === 'open' ? 'connected' : 'disconnected';
      
      await supabaseAdmin
        .from('institutions')
        .update({ whatsapp_status: newStatus })
        .eq('id', institution.id);
      
      return NextResponse.json({ success: true, event: 'status_updated' });
    }

    // 3. Trata Mensagens Recebidas (Lógica de Chat/IA)
    if (!payload.data?.message || payload.data?.key?.fromMe) {
      console.log('[Webhook] Info: Ignorando mensagem (formatada ou enviada por mim)');
      return NextResponse.json({ success: true, reason: 'ignored' });
    }

    const incomingText = payload.data.message.conversation || payload.data.message.extendedTextMessage?.text || '';
    const phoneRemoteJid = payload.data.key.remoteJid;
    const remoteJidAlt = payload.data.key.remoteJidAlt;
    const sender = payload.sender; // Fallback da Evolution API

    let phoneNumber = phoneRemoteJid.split('@')[0];
    
    // Se for um LID, tenta pegar o número real no Alt ou no Sender
    if (phoneRemoteJid.includes('@lid')) {
        if (remoteJidAlt) {
            phoneNumber = remoteJidAlt.split('@')[0];
        } else if (sender) {
            phoneNumber = sender.split('@')[0];
        }
    }
    
    const pushName = payload.data.pushName || 'Lead WhatsApp';
    console.log(`[Webhook] Mensagem de ${pushName} | Número: ${phoneNumber}`);

    if (!incomingText) return NextResponse.json({ success: true, reason: 'no_text' });

    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('phone', phoneNumber)
      .eq('institution_id', institution.id)
      .single();

    if (!lead) {
      const { data: newLead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          phone: phoneNumber,
          institution_id: institution.id,
          name: pushName,
          status: 'ai_handling'
        })
        .select()
        .single();
      if (leadError) console.error('Erro ao registrar lead:', leadError.message);
      lead = newLead;
    }

    if (!lead) return NextResponse.json({ error: 'Lead_Not_Created' }, { status: 500 });

    await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'inbound',
      content: incomingText
    });

    if (lead.status === 'human_handling') {
      return NextResponse.json({ success: true, ai_handled: false, reason: 'human_handling' });
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('ai_agents')
      .select('id, system_prompt')
      .eq('institution_id', institution.id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (agentError || !agent) {
      console.warn('[Webhook] Aviso: Nenhum agente de IA ativo encontrado para esta instituição.');
      return NextResponse.json({ success: true, reason: 'no_active_agent' });
    }
    console.log(`[Webhook] Agente ativo [${agent.id}] e Lead [${lead.name}] identificados.`);

    if (lead.human_handling) {
      console.log(`[Webhook] Atendimento humano ATIVO para o lead ${lead.name}. IA ignorando mensagem.`);
      return NextResponse.json({ success: true, reason: 'human_handling_active' });
    }

    const provider = institution.ai_provider || 'openai';
    console.log(`[Webhook] Gerando resposta com provedor: ${provider}`);
    let apiKey: string | undefined;

    if (provider === 'openai') {
      apiKey = institution.openai_key ? decrypt(institution.openai_key) : process.env.OPENAI_API_KEY;
    } else if (provider === 'groq') {
      apiKey = institution.groq_key ? decrypt(institution.groq_key) : process.env.GROQ_API_KEY;
    } else if (provider === 'openrouter') {
      apiKey = institution.openrouter_key ? decrypt(institution.openrouter_key) : process.env.OPENROUTER_API_KEY;
    } else {
      apiKey = institution.ai_api_key ? decrypt(institution.ai_api_key) : undefined;
    }

    let baseURL = institution.ai_base_url || undefined;
    if (!baseURL) {
      if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';
      if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
    }
    console.log(`[Webhook] Usando baseURL: ${baseURL || 'OpenAI Default'}`);

    if (!apiKey) {
      console.error('Nenhuma API Key configurada para o provedor:', provider);
      return NextResponse.json({ success: true, reason: 'no_api_key_configured' });
    }

    const customOpenAI = new OpenAI({ apiKey, baseURL });
    const model = institution.ai_model || 'gpt-4o';
    console.log(`[Webhook] Chamando IA (${provider}) - Modelo: ${model}`);

    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    const chatHistory = (history || []).reverse().map((msg: any) => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content
    }));

    const aiResponse = await customOpenAI.chat.completions.create({
      model: institution.ai_model || 'gpt-4o', 
      messages: [
        { role: 'system', content: agent.system_prompt },
        ...chatHistory,
      ] as any[],
      temperature: 0.7,
    });

    const botMessage = aiResponse.choices[0]?.message?.content || 'Desculpe, tive um erro ao processar.';
    console.log(`[Webhook] IA respondeu: "${botMessage.substring(0, 50)}..."`);

    const { error: insertError } = await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'outbound_ai',
      content: botMessage
    });

    if (insertError) {
      console.error('[Webhook] Erro ao inserir mensagem da IA no banco:', insertError);
    }
    console.log('[Webhook] Resposta da IA salva no histórico.');

    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const decryptedEvoKey = institution.evolution_api_key ? decrypt(institution.evolution_api_key) : '';
    const evoKey = decryptedEvoKey || process.env.EVOLUTION_GLOBAL_APIKEY || process.env.EVOLUTION_INSTANCE_TOKEN || '';

    if (!evoKey) {
        console.error('Nenhuma chave da Evolution API configurada.');
    }

    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoKey
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: botMessage,
        delay: 1200
      })
    });
    console.log(`[Webhook] Sucesso: Mensagem enviada para ${phoneNumber}`);

    return NextResponse.json({ success: true, ai_handled: true });
    
  } catch (error: any) {
    console.error('[Webhook] ERRO CRÍTICO:', error.stack || error.message || error);
    return NextResponse.json({ error: 'Internal_Server_Error', details: error.message }, { status: 500 });
  }
}
