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
    console.warn('[Webhook] Aviso: EVOLUTION_WEBHOOK_SECRET não configurado. Aceitando sem validação HMAC (Modo Permissivo).');
    return true;
  }

  const signature = request.headers.get('x-evol-signature');
  if (!signature) {
    console.warn('[Webhook] Aviso: Assinatura HMAC ausente no cabeçalho. Aceitando por compatibilidade.');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Monta o system prompt final combinando um prefixo de estilo de comunicação
 * com o prompt personalizado do agente.
 *
 * O prefixo de estilo PRECEDE o prompt do usuário porque LLMs tendem a
 * obedecer instruções no início do contexto com mais consistência.
 */
/**
 * Busca dados dinâmicos do sistema (Cursos e Turmas) para servir de Base de Conhecimento.
 */
async function fetchKnowledgeBase(supabase: any, institutionId: string): Promise<string> {
  const [coursesRes, classesRes] = await Promise.all([
    supabase
      .from('courses')
      .select('name, description, price, modality')
      .eq('institution_id', institutionId)
      .eq('is_active', true),
    supabase
      .from('classes')
      .select('name, schedule, start_date, status, course_id')
      .eq('institution_id', institutionId)
      .eq('status', 'open')
  ]);

  const courses = coursesRes.data || [];
  const classes = classesRes.data || [];

  if (courses.length === 0 && classes.length === 0) return '';

  const contextLines = [
    '### BASE DE CONHECIMENTO DA INSTITUIÇÃO (DADOS REAIS DO SISTEMA)',
    'Use APENAS estas informações para responder sobre cursos e vagas:',
    '',
    'CURSOS DISPONÍVEIS:',
  ];

  courses.forEach((c: any) => {
    contextLines.push(`- ${c.name}: ${c.description || 'Sem descrição'}. Preço: R$ ${c.price || 'Sob consulta'}. Modalidade: ${c.modality}.`);
  });

  if (classes.length > 0) {
    contextLines.push('', 'TURMAS E VAGAS ABERTAS:');
    classes.forEach((cl: any) => {
      const course = courses.find((c: any) => c.id === cl.course_id);
      contextLines.push(`- Turma ${cl.name}${course ? ` (do curso ${course.name})` : ''}: Horário ${cl.schedule || 'A combinar'}. Começa em: ${cl.start_date || 'TBD'}.`);
    });
  }

  return contextLines.join('\n');
}

/**
 * Monta o system prompt final combinando um prefixo de estilo de comunicação,
 * as restrições rígidas de escopo e a base de conhecimento dinâmica.
 */
function buildSystemPrompt(agentSystemPrompt: string, style: string, knowledgeBase: string): string {
  const guardrails = [
    '⚠️ DIRETRIZES DE SEGURANÇA E FOCO (ESTRITO):',
    '1. Você é um assistente virtual da instituição. Seu conhecimento é LIMITADO à "BASE DE CONHECIMENTO" abaixo.',
    '2. NUNCA responda sobre assuntos externos (política, previsão do tempo, outras empresas, receitas, conselhos gerais, etc).',
    '3. Se o usuário perguntar algo fora do escopo do sistema, responda educadamente: "Desculpe, como assistente virtual desta instituição, só posso ajudar com informações sobre nossos cursos e atendimentos oficiais."',
    '4. NUNCA invente preços, horários ou cursos. Se não estiver na lista, você não sabe.',
    '5. Mantenha o foco absoluto em converter o interessado em aluno ou agendar uma visita.',
    '',
  ].join('\n');

  const stylePrefix: Record<string, string> = {
    whatsapp: [
      'REGRAS DE COMUNICAÇÃO:',
      '- Responda no WhatsApp. Seja humano e empático.',
      '- Use emojis relevantes. 😊',
      '- MÁXIMO 2 frases curtas por mensagem.',
      '- Tom descontraído e amigável.',
      '- Vá direto ao ponto.',
      '',
    ].join('\n'),
    casual: [
      'ESTILO: Informal e amigável. Respostas curtas.',
      '',
    ].join('\n'),
    formal: [
      'ESTILO: Profissional, claro e respeitoso.',
      '',
    ].join('\n'),
    default: '',
  };

  const prefix = stylePrefix[style] || '';
  
  return [
    guardrails,
    prefix,
    '---',
    'MISSÃO PERSONALIZADA DO AGENTE:',
    agentSystemPrompt,
    '',
    knowledgeBase ? knowledgeBase : '--- Nenhuma base de conhecimento específica carregada no momento ---'
  ].join('\n');
}

/**
 * Envia texto para o WhatsApp via Evolution API.
 * Se enable_line_breaks=true, divide a mensagem por \n\n e envia cada parte com delay.
 */
async function sendEvolutionMessage(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  phoneNumber: string,
  text: string,
  enableLineBreaks: boolean,
  delayMs: number
): Promise<void> {
  const baseDelay = Math.max(300, Math.min(delayMs, 5000));

  if (enableLineBreaks) {
    // Divide por \n\n (dois newlines) OU por \n simples — LLMs usam ambos
    const parts = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    console.log(`[Webhook] Quebra de linha ATIVA — ${parts.length} parte(s) para enviar`);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partDelay = i === 0 ? 1200 : baseDelay;

      console.log(`[Webhook] Enviando parte ${i + 1}/${parts.length}: "${part.substring(0, 40)}..."`);

      const sendRes = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evoKey,
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: part,
          delay: partDelay,
        }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error(`[Webhook] Erro ao enviar parte ${i + 1}:`, errText);
      }

      // Aguarda entre partes para parecer mais natural
      if (i < parts.length - 1) {
        await new Promise((r) => setTimeout(r, baseDelay));
      }
    }
  } else {
    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoKey,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text,
        delay: 1200,
      }),
    });
  }
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
    console.error('[Webhook] Erro: Assinatura HMAC inválida.');
    return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(bodyText);
    const instanceName = payload.instance;
    const event = payload.event;

    console.log('[Webhook] FULL PAYLOAD:', JSON.stringify(payload, null, 2));
    console.log(`[Webhook] Instância: ${instanceName} | Evento: ${event}`);

    // 1. Identifica a Instituição
    const { data: institution, error: instError } = await supabaseAdmin
      .from('institutions')
      .select('*')
      .eq('evolution_instance_name', instanceName)
      .single();

    if (instError || !institution) {
      console.error(`[Webhook] Instituição não encontrada para "${instanceName}"`);
      return NextResponse.json({ error: 'Institution_Not_Found' }, { status: 404 });
    }
    console.log(`[Webhook] Instituição: ${institution.name} (ID: ${institution.id})`);

    // 2. Trata Eventos de Conexão
    if (event === 'connection.update') {
      const state = payload.data?.state;
      const newStatus = state === 'open' ? 'connected' : 'disconnected';

      await supabaseAdmin
        .from('institutions')
        .update({ whatsapp_status: newStatus })
        .eq('id', institution.id);

      return NextResponse.json({ success: true, event: 'status_updated' });
    }

    // 3. Filtra mensagens irrelevantes
    if (!payload.data?.message || payload.data?.key?.fromMe) {
      console.log('[Webhook] Ignorando mensagem (sem conteúdo ou enviada por mim)');
      return NextResponse.json({ success: true, reason: 'ignored' });
    }

    const incomingText =
      payload.data.message.conversation ||
      payload.data.message.extendedTextMessage?.text ||
      '';

    const phoneRemoteJid = payload.data.key.remoteJid;
    const remoteJidAlt = payload.data.key.remoteJidAlt;
    const sender = payload.sender;

    let phoneNumber = phoneRemoteJid.split('@')[0];

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

    // 4. Busca ou cria o Lead
    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('phone', phoneNumber)
      .eq('institution_id', institution.id)
      .single();

    const isNewLead = !lead;

    if (!lead) {
      const { data: newLead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          phone: phoneNumber,
          institution_id: institution.id,
          name: pushName,
          status: 'ai_handling',
        })
        .select()
        .single();
      if (leadError) console.error('Erro ao registrar lead:', leadError.message);
      lead = newLead;
    }

    if (!lead) return NextResponse.json({ error: 'Lead_Not_Created' }, { status: 500 });

    // 5. Salva mensagem inbound
    await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'inbound',
      content: incomingText,
    });

    // 6. Verifica se está em atendimento humano
    if (lead.status === 'human_handling' || lead.human_handling) {
      console.log(`[Webhook] Atendimento humano ativo para ${lead.name}. IA ignorando.`);
      return NextResponse.json({ success: true, ai_handled: false, reason: 'human_handling' });
    }

    // 7. Busca o Agente de IA — usa queries SEPARADAS para evitar mutação do builder
    // Tenta primeiro o agente marcado como padrão
    const { data: defaultAgent } = await supabaseAdmin
      .from('ai_agents')
      .select('*')
      .eq('institution_id', institution.id)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    // Se não houver padrão, pega o primeiro agente ativo
    const { data: firstActiveAgent } = defaultAgent
      ? { data: null }
      : await supabaseAdmin
          .from('ai_agents')
          .select('*')
          .eq('institution_id', institution.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

    const agent = defaultAgent || firstActiveAgent;
    console.log(`[Webhook] Agente resolvido: is_default=${defaultAgent ? 'true' : 'false'} | enable_line_breaks=${agent?.enable_line_breaks} | id=${agent?.id}`);

    if (!agent) {
      console.warn('[Webhook] Nenhum agente de IA ativo encontrado para esta instituição.');
      return NextResponse.json({ success: true, reason: 'no_active_agent' });
    }
    console.log(`[Webhook] Agente: "${agent.name}" | Papel: ${agent.agent_role || 'custom'}`);

    // 8. Preparar Evolution API
    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const decryptedEvoKey = institution.evolution_api_key
      ? decrypt(institution.evolution_api_key)
      : '';
    const evoKey =
      decryptedEvoKey ||
      process.env.EVOLUTION_GLOBAL_APIKEY ||
      process.env.EVOLUTION_INSTANCE_TOKEN ||
      '';

    if (!evoKey) {
      console.error('[Webhook] Nenhuma chave da Evolution API configurada.');
    }

    // 9. Envia greeting message para novo lead (se configurado no agente)
    if (isNewLead && agent.greeting_message) {
      console.log(`[Webhook] Enviando mensagem de boas-vindas para ${phoneNumber}`);
      await sendEvolutionMessage(
        evoUrl,
        evoKey,
        instanceName,
        phoneNumber,
        agent.greeting_message,
        agent.enable_line_breaks ?? false,
        agent.response_delay_ms ?? 800
      );

      await supabaseAdmin.from('messages').insert({
        lead_id: lead.id,
        institution_id: institution.id,
        direction: 'outbound_ai',
        content: agent.greeting_message,
      });
    }

    // 10. Resolve provedor e API Key (agente tem prioridade, senão herda da instituição)
    const provider = institution.ai_provider || 'openai';
    let apiKey: string | undefined;

    if (provider === 'openai') {
      apiKey = institution.openai_key
        ? decrypt(institution.openai_key)
        : process.env.OPENAI_API_KEY;
    } else if (provider === 'groq') {
      apiKey = institution.groq_key
        ? decrypt(institution.groq_key)
        : process.env.GROQ_API_KEY;
    } else if (provider === 'openrouter') {
      apiKey = institution.openrouter_key
        ? decrypt(institution.openrouter_key)
        : process.env.OPENROUTER_API_KEY;
    } else {
      apiKey = institution.ai_api_key ? decrypt(institution.ai_api_key) : undefined;
    }

    let baseURL = institution.ai_base_url || undefined;
    if (!baseURL) {
      if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';
      if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
    }

    if (!apiKey) {
      console.error('[Webhook] Nenhuma API Key configurada para o provedor:', provider);

      // Usa fallback message do agente se disponível
      const fallback =
        agent.fallback_message ||
        'Desculpe, estou com dificuldades técnicas no momento. Um atendente irá te ajudar em breve.';

      await sendEvolutionMessage(
        evoUrl,
        evoKey,
        instanceName,
        phoneNumber,
        fallback,
        false,
        800
      );

      return NextResponse.json({ success: true, reason: 'no_api_key_configured' });
    }

    // 11. Monta histórico de mensagens (respeitando max_history_messages do agente)
    const historyLimit = agent.max_history_messages ?? 10;
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(historyLimit);

    const chatHistory = (history || []).reverse().map((msg: any) => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // 11.5 Busca Base de Conhecimento Dinâmica do Sistema
    const knowledgeBase = await fetchKnowledgeBase(supabaseAdmin, institution.id);

    // 12. Chama a IA usando configs do agente (com fallback para a instituição)
    const model = agent.ai_model_override || institution.ai_model || 'gpt-4o';
    const temperature = agent.temperature ?? 0.7;
    const commStyle = agent.communication_style || 'default';

    // WhatsApp e Casual forçam um teto de tokens para evitar respostas longas
    const STYLE_TOKEN_CAPS: Record<string, number> = {
      whatsapp: 200,
      casual: 300,
      formal: 500,
      default: 500,
    };
    const styleCap = STYLE_TOKEN_CAPS[commStyle] ?? 500;
    const maxTokens = Math.min(agent.max_tokens ?? styleCap, styleCap);

    // Monta o system prompt com o prefixo de estilo, guardrails e conhecimento
    const fullSystemPrompt = buildSystemPrompt(
      agent.system_prompt || '', 
      commStyle,
      knowledgeBase
    );

    console.log(
      `[Webhook] Chamando IA (${provider}) | Modelo: ${model} | Temp: ${temperature} | Tokens: ${maxTokens} | Estilo: ${commStyle}`
    );
    console.log(`[Webhook] System prompt (${fullSystemPrompt.length} chars): "${fullSystemPrompt.substring(0, 120)}..."`);

    const customOpenAI = new OpenAI({ apiKey, baseURL });

    let botMessage: string;

    try {
      const aiResponse = await customOpenAI.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...chatHistory,
        ] as any[],
        temperature,
        max_tokens: maxTokens,
      });


      botMessage =
        aiResponse.choices[0]?.message?.content ||
        agent.fallback_message ||
        'Desculpe, tive um problema ao processar sua mensagem.';
    } catch (aiError: any) {
      console.error('[Webhook] Erro ao chamar IA:', aiError.message);

      botMessage =
        agent.fallback_message ||
        'Desculpe, estou com dificuldades no momento. Um atendente irá te ajudar em breve.';
    }

    console.log(`[Webhook] IA respondeu: "${botMessage.substring(0, 80)}..."`);

    // 13. Salva resposta da IA no histórico
    const { error: insertError } = await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'outbound_ai',
      content: botMessage,
    });

    if (insertError) {
      console.error('[Webhook] Erro ao salvar resposta da IA:', insertError);
    }

    // 14. Envia resposta (com ou sem quebra de linha)
    const enableLineBreaks = agent.enable_line_breaks ?? false;
    const responseDelay = agent.response_delay_ms ?? 800;

    await sendEvolutionMessage(
      evoUrl,
      evoKey,
      instanceName,
      phoneNumber,
      botMessage,
      enableLineBreaks,
      responseDelay
    );

    console.log(`[Webhook] ✅ Mensagem enviada para ${phoneNumber} | Quebra de linha: ${enableLineBreaks}`);

    return NextResponse.json({ success: true, ai_handled: true });
  } catch (error: any) {
    console.error('[Webhook] ERRO CRÍTICO:', error.stack || error.message || error);
    return NextResponse.json(
      { error: 'Internal_Server_Error', details: error.message },
      { status: 500 }
    );
  }
}
