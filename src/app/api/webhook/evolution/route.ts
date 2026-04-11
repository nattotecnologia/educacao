import { NextResponse, NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { decrypt } from '@/utils/encryption';
import { rateLimit } from '@/utils/rate-limit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET || '';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Course {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  modality: string;
  duration_hours: number | null;
}

interface ClassRow {
  id: string;
  name: string;
  schedule: string | null;
  start_date: string | null;
  status: string;
  course_id: string;
  total_slots: number;
  filled_slots: number;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'your_webhook_secret_here') {
    console.warn('[Webhook] Aviso: EVOLUTION_WEBHOOK_SECRET não configurado. Aceitando sem validação HMAC.');
    return true;
  }

  const signature = request.headers.get('x-evol-signature');
  if (!signature) {
    console.warn('[Webhook] Aviso: Assinatura HMAC ausente. Aceitando por compatibilidade.');
    return true;
  }

  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return signature === expected;
}

// ---------------------------------------------------------------------------
// Knowledge base (courses + classes) — FIX: agora inclui `id` nos cursos
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchKnowledgeBase(
  supabase: SupabaseClient<any, any, any>,
  institutionId: string
): Promise<{ text: string; courses: Course[]; classes: ClassRow[] }> {
  const [coursesRes, classesRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, name, description, price, modality, duration_hours') // id agora incluído
      .eq('institution_id', institutionId)
      .eq('is_active', true),
    supabase
      .from('classes')
      .select('id, name, schedule, start_date, status, course_id, total_slots, filled_slots')
      .eq('institution_id', institutionId)
      .eq('status', 'open'),
  ]);

  const courses: Course[] = (coursesRes.data as Course[]) || [];
  const classes: ClassRow[] = (classesRes.data as ClassRow[]) || [];

  if (courses.length === 0 && classes.length === 0) {
    return { text: '', courses, classes };
  }

  const lines: string[] = [
    '### CURSOS E TURMAS DISPONÍVEIS (dados reais do sistema):',
    '',
  ];

  courses.forEach((c) => {
    const price = c.price ? `R$ ${Number(c.price).toFixed(2)}` : 'Sob consulta';
    const duration = c.duration_hours ? `${c.duration_hours}h` : null;
    const extras = [c.modality, duration].filter(Boolean).join(', ');
    lines.push(`📚 **${c.name}** — ${c.description || 'Sem descrição'}. Preço: ${price}. (${extras})`);

    // Turmas deste curso
    const courseClasses = classes.filter((cl) => cl.course_id === c.id);
    if (courseClasses.length > 0) {
      courseClasses.forEach((cl) => {
        const vagas = cl.total_slots - cl.filled_slots;
        lines.push(
          `   • Turma "${cl.name}": horário ${cl.schedule || 'A combinar'}, início ${cl.start_date || 'TBD'}. Vagas disponíveis: ${vagas}.`
        );
      });
    } else {
      lines.push('   • Nenhuma turma aberta no momento.');
    }
    lines.push('');
  });

  return { text: lines.join('\n'), courses, classes };
}

// ---------------------------------------------------------------------------
// System prompt — prioriza o prompt do usuário
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  userSystemPrompt: string,
  style: string,
  knowledgeBase: string
): string {
  // O prompt do agente vem primeiro para que a persona seja respeitada
  const agentPersona = userSystemPrompt?.trim()
    ? `## IDENTIDADE E MISSÃO DO AGENTE\n${userSystemPrompt.trim()}`
    : '## IDENTIDADE E MISSÃO DO AGENTE\nVocê é um assistente virtual educacional prestativo e amigável.';

  // Capacidades que a IA pode acionar
  const capabilities = [
    '## SUAS CAPACIDADES E REGRAS DE OURO',
    'Você pode ajudar o lead a realizar Matrículas e Agendamentos de Visita.',
    '',
    '⚠️ REGRA DE OURO 1: PROATIVIDADE E CONSULTA',
    '- Antes de pedir qualquer dado, VALORIZE o interesse do lead.',
    '- Se o lead perguntar sobre um curso ou matrícula, PRIMEIRO explique os benefícios e detalhes desse curso usando a BASE DE CONHECIMENTO abaixo.',
    '- Ofereça ajuda para se matricular ou agendar uma visita APÓS fornecer as informações solicitadas.',
    '',
    '⚠️ REGRA DE OURO 2: COLETA INDIVIDUAL (UM POR VEZ)',
    '- NUNCA apresente uma lista numerada de perguntas para o lead.',
    '- Peça apenas UM dado por vez (ex: primeiro o nome, espere a resposta, depois o e-mail).',
    '- Se o lead já forneceu algum dado na frase anterior, não peça novamente.',
    '',
    '⚠️ REGRA DE OURO 3: FUNÇÕES TÉCNICAS',
    '1. **MATRÍCULA**: Colete: nome completo, e-mail e a turma desejada. Utilize a função `register_enrollment`.',
    '2. **VISITA**: Colete: nome e data/hora preferida. Utilize a função `register_visit`.',
  ].join('\n');

  // Base de conhecimento dinâmica
  const knowledge = knowledgeBase
    ? `## BASE DE CONHECIMENTO (DADOS REAIS DA INSTITUIÇÃO)\n${knowledgeBase}`
    : '## BASE DE CONHECIMENTO\nNenhum curso cadastrado no momento. Informe ao lead que a grade está sendo atualizada.';

  // Estilo de comunicação como reforço (não sobrescreve a persona)
  const styleGuides: Record<string, string> = {
    whatsapp: '## ESTILO DE COMUNICAÇÃO (WHATSAPP)\n- Seja humano e empático.\n- Use quebra de linha dupla (\\n\\n) para separar bolhas de mensagem diferentes.\n- Máximo 2 parágrafos curtos por resposta.',
    casual: '## ESTILO DE COMUNICAÇÃO\nSeja informal e amigável. Respostas curtas.',
    formal: '## ESTILO DE COMUNICAÇÃO\nSeja profissional, claro e respeitoso.',
    default: '',
  };
  const styleGuide = styleGuides[style] || '';

  return [
    agentPersona,
    '',
    capabilities,
    '',
    knowledge,
    styleGuide ? `\n${styleGuide}` : '',
  ]
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// OpenAI Tools (Function Calling) definitions
// ---------------------------------------------------------------------------

const AGENT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'register_enrollment',
      description:
        'Registra a matrícula de um aluno em uma turma. Use SOMENTE quando tiver coletado o nome completo, e-mail e a turma desejada.',
      parameters: {
        type: 'object',
        properties: {
          student_name: { type: 'string', description: 'Nome completo do aluno' },
          student_email: { type: 'string', description: 'E-mail do aluno' },
          student_phone: { type: 'string', description: 'Telefone do aluno (já conhecido)' },
          student_cpf: { type: 'string', description: 'CPF do aluno (opcional)' },
          class_name: { type: 'string', description: 'Nome exato da turma conforme a base de conhecimento' },
          notes: { type: 'string', description: 'Observações adicionais (opcional)' },
        },
        required: ['student_name', 'student_email', 'class_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'register_visit',
      description:
        'Agenda uma visita presencial à instituição. Use quando tiver o nome e a data/hora desejada.',
      parameters: {
        type: 'object',
        properties: {
          lead_name: { type: 'string', description: 'Nome do interessado' },
          lead_phone: { type: 'string', description: 'Telefone (já conhecido)' },
          scheduled_at: {
            type: 'string',
            description: 'Data e hora da visita em formato ISO 8601 (ex: 2025-04-15T14:00:00)',
          },
          notes: { type: 'string', description: 'Observações ou interesses do visitante (opcional)' },
        },
        required: ['lead_name', 'scheduled_at'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Execute tool calls returned by the AI
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  args: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  institutionId: string,
  leadId: string | null,
  phone: string,
  classes: ClassRow[]
): Promise<string> {
  if (toolName === 'register_enrollment') {
    const { student_name, student_email, student_phone, student_cpf, class_name, notes } = args;

    // Encontra a turma pelo nome (case-insensitive)
    const foundClass = classes.find(
      (c) => c.name.toLowerCase() === class_name?.toLowerCase()
    );

    if (!foundClass) {
      return `❌ Não encontrei a turma "${class_name}" na lista de turmas abertas. Por favor, verifique o nome da turma.`;
    }

    const vagas = foundClass.total_slots - foundClass.filled_slots;
    if (vagas <= 0) {
      return `😔 Infelizmente a turma "${class_name}" não tem mais vagas disponíveis. Posso te colocar em uma lista de espera ou indicar outra turma?`;
    }

    const { error } = await supabase.from('enrollments').insert({
      institution_id: institutionId,
      class_id: foundClass.id,
      lead_id: leadId || null,
      student_name,
      student_email: student_email || null,
      student_phone: student_phone || phone,
      student_cpf: student_cpf || null,
      notes: notes || null,
      status: 'pending',
    });

    if (error) {
      console.error('[Webhook] Erro ao registrar matrícula:', error.message);
      return '❌ Ocorreu um erro ao registrar sua matrícula. Por favor, tente novamente ou entre em contato com a secretaria.';
    }

    // Incrementar contador de vagas preenchidas
    await supabase
      .from('classes')
      .update({ filled_slots: foundClass.filled_slots + 1 })
      .eq('id', foundClass.id);

    // Atualizar status do lead para converted
    if (leadId) {
      await supabase.from('leads').update({ status: 'converted' }).eq('id', leadId);
    }

    return `✅ Matrícula registrada com sucesso! ${student_name} foi pré-matriculado(a) na turma "${class_name}". Nossa equipe entrará em contato para confirmar os próximos passos e enviar as informações de pagamento.`;
  }

  if (toolName === 'register_visit') {
    const { lead_name, lead_phone, scheduled_at, notes } = args;

    const { error } = await supabase.from('visit_appointments').insert({
      institution_id: institutionId,
      lead_id: leadId || null,
      lead_name,
      lead_phone: lead_phone || phone,
      scheduled_at,
      notes: notes || null,
      status: 'scheduled',
    });

    if (error) {
      console.error('[Webhook] Erro ao registrar visita:', error.message);
      return '❌ Não consegui registrar sua visita. Por favor, tente novamente ou ligue para nós.';
    }

    // Formata a data de forma amigável
    const dateFormatted = new Date(scheduled_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `✅ Visita agendada com sucesso! ${lead_name}, te esperamos no dia ${dateFormatted}. Você receberá uma confirmação. Caso precise reagendar, é só nos chamar! 😊`;
  }

  return '❌ Ação não reconhecida.';
}

// ---------------------------------------------------------------------------
// Send WhatsApp message via Evolution API
// ---------------------------------------------------------------------------

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
    const parts = text
      .split('\n\n') // Split only on double newlines for separate bubbles
      .map((p) => p.trim())
      .filter(Boolean);

    console.log(`[Webhook] Quebra de linha ATIVA — ${parts.length} parte(s)`);

    for (let i = 0; i < parts.length; i++) {
      await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: phoneNumber, text: parts[i], delay: i === 0 ? 1200 : baseDelay }),
      });

      if (i < parts.length - 1) {
        await new Promise((r) => setTimeout(r, baseDelay));
      }
    }
  } else {
    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({ number: phoneNumber, text, delay: 1200 }),
    });
  }
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(request);
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  console.log(`[Webhook] POST recebido em ${new Date().toISOString()}`);

  const bodyText = await request.text();

  if (!verifyWebhookSignature(request, bodyText)) {
    console.error('[Webhook] Assinatura inválida.');
    return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(bodyText);
    const instanceName = payload.instance;
    const event = payload.event;

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

    // 2. Trata eventos de conexão
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

    if (!incomingText) return NextResponse.json({ success: true, reason: 'no_text' });

    const phoneRemoteJid: string = payload.data.key.remoteJid;
    const remoteJidAlt: string | undefined = payload.data.key.remoteJidAlt;
    const sender: string | undefined = payload.sender;

    let phoneNumber = phoneRemoteJid.split('@')[0];
    if (phoneRemoteJid.includes('@lid')) {
      if (remoteJidAlt) phoneNumber = remoteJidAlt.split('@')[0];
      else if (sender) phoneNumber = sender.split('@')[0];
    }

    const pushName: string = payload.data.pushName || 'Lead WhatsApp';
    console.log(`[Webhook] Mensagem de ${pushName} | Número: ${phoneNumber} | Texto: "${incomingText}"`);

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
        .insert({ phone: phoneNumber, institution_id: institution.id, name: pushName, status: 'ai_handling' })
        .select()
        .single();
      if (leadError) console.error('[Webhook] Erro ao registrar lead:', leadError.message);
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

    // 6. Verifica atendimento humano
    if (lead.status === 'human_handling') {
      console.log(`[Webhook] Atendimento humano ativo para ${lead.name}. IA ignorando.`);
      return NextResponse.json({ success: true, ai_handled: false, reason: 'human_handling' });
    }

    // 7. Busca o Agente de IA
    const { data: defaultAgent } = await supabaseAdmin
      .from('ai_agents')
      .select('*')
      .eq('institution_id', institution.id)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

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

    if (!agent) {
      console.warn('[Webhook] Nenhum agente ativo encontrado.');
      return NextResponse.json({ success: true, reason: 'no_active_agent' });
    }
    console.log(`[Webhook] Agente: "${agent.name}" | Papel: ${agent.agent_role || 'custom'} | is_default: ${!!defaultAgent}`);

    // 8. Prepara Evolution API
    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const decryptedEvoKey = institution.evolution_api_key ? decrypt(institution.evolution_api_key) : '';
    const evoKey =
      decryptedEvoKey ||
      process.env.EVOLUTION_GLOBAL_APIKEY ||
      process.env.EVOLUTION_INSTANCE_TOKEN ||
      '';

    // 9. Greeting para novo lead
    if (isNewLead && agent.greeting_message) {
      console.log(`[Webhook] Enviando boas-vindas para ${phoneNumber}`);
      await sendEvolutionMessage(
        evoUrl, evoKey, instanceName, phoneNumber,
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

    // 10. Resolve API Key da IA
    const provider: string = institution.ai_provider || 'openai';
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

    let baseURL: string | undefined = institution.ai_base_url || undefined;
    if (!baseURL) {
      if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';
      if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
    }

    if (!apiKey) {
      console.error('[Webhook] Nenhuma API Key configurada para:', provider);
      const fallback =
        agent.fallback_message ||
        'Desculpe, estou com dificuldades técnicas. Um atendente irá te ajudar em breve.';
      await sendEvolutionMessage(evoUrl, evoKey, instanceName, phoneNumber, fallback, false, 800);
      return NextResponse.json({ success: true, reason: 'no_api_key' });
    }

    // 11. Histórico de mensagens
    const historyLimit = agent.max_history_messages ?? 10;
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(historyLimit);

    const chatHistory: OpenAI.Chat.ChatCompletionMessageParam[] = (history || [])
      .reverse()
      .map((msg: { direction: string; content: string }) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content,
      }));

    // 12. Base de conhecimento (FIX: id incluído)
    const { text: knowledgeText, classes } = await fetchKnowledgeBase(supabaseAdmin, institution.id);

    // 13. Monta system prompt (prioriza prompt do usuário)
    const commStyle: string = agent.communication_style || 'default';
    const fullSystemPrompt = buildSystemPrompt(agent.system_prompt || '', commStyle, knowledgeText);

    const model: string = agent.ai_model_override || institution.ai_model || 'gpt-4o';
    const temperature: number = agent.temperature ?? 0.7;

    // Aumentando limite de tokens para evitar cortes no meio da resposta
    const maxTokens = Math.min(agent.max_tokens ?? 800, 1000);

    console.log(`[Webhook] IA: ${provider}/${model} | Temp: ${temperature} | Tokens: ${maxTokens} | Estilo: ${commStyle}`);
    console.log(`[Webhook] System prompt (${fullSystemPrompt.length} chars) preview: "${fullSystemPrompt.substring(0, 150)}..."`);

    const customOpenAI = new OpenAI({ apiKey, baseURL });

    // 14. Chama a IA com Function Calling
    let botMessage: string;

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: fullSystemPrompt },
        ...chatHistory,
      ];

      const aiResponse = await customOpenAI.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
      });

      const choice = aiResponse.choices[0];

      // Verifica se a IA quer executar uma função
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCall = choice.message.tool_calls[0] as any;
        const toolName = toolCall.function.name as string;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}') as Record<string, string>;

        console.log(`[Webhook] Tool call: ${toolName}`, toolArgs);

        // Completa o número de telefone nos args antes de salvar
        if (!toolArgs.student_phone && toolName === 'register_enrollment') {
          toolArgs.student_phone = phoneNumber;
        }
        if (!toolArgs.lead_phone && toolName === 'register_visit') {
          toolArgs.lead_phone = phoneNumber;
        }

        // Executa a ação no banco
        const toolResult = await executeTool(
          toolName,
          toolArgs,
          supabaseAdmin,
          institution.id,
          lead.id,
          phoneNumber,
          classes
        );

        // Pede à IA para formatar uma resposta humana com o resultado
        const confirmationResponse = await customOpenAI.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...chatHistory,
            choice.message,
            {
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        botMessage =
          confirmationResponse.choices[0]?.message?.content ||
          toolResult; // usa o resultado diretamente como fallback
      } else {
        botMessage =
          choice.message?.content ||
          agent.fallback_message ||
          'Desculpe, tive um problema ao processar sua mensagem.';
      }
    } catch (aiError: unknown) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('[Webhook] Erro ao chamar IA:', errMsg);
      botMessage =
        agent.fallback_message ||
        'Desculpe, estou com dificuldades no momento. Um atendente irá te ajudar em breve.';
    }

    console.log(`[Webhook] Resposta da IA: "${botMessage.substring(0, 100)}..."`);

    // 15. Salva resposta no histórico
    await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'outbound_ai',
      content: botMessage,
    });

    // 16. Envia resposta pelo WhatsApp
    await sendEvolutionMessage(
      evoUrl,
      evoKey,
      instanceName,
      phoneNumber,
      botMessage,
      agent.enable_line_breaks ?? false,
      agent.response_delay_ms ?? 800
    );

    console.log(`[Webhook] ✅ Mensagem enviada para ${phoneNumber}`);
    return NextResponse.json({ success: true, ai_handled: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[Webhook] ERRO CRÍTICO:', errMsg);
    return NextResponse.json({ error: 'Internal_Server_Error', details: errMsg }, { status: 500 });
  }
}
