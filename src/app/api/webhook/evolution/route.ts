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
    lines.push(`📚 *${c.name}* — ${c.description || 'Sem descrição'}. Preço: ${price}. (${extras})`);

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
  knowledgeBase: string,
  leadName: string,
  leadPhone: string,
  institutionName: string
): string {
  // Limpa placeholders comuns no prompt do usuário para evitar que a IA fale "[NOME DA INSTITUIÇÃO]"
  const sanitizedUserPrompt = (userSystemPrompt || '')
    .replace(/\[NOME DA INSTITUIÇÃO\]/gi, institutionName)
    .replace(/\[NOME_DA_INSTITUICAO\]/gi, institutionName)
    .replace(/{institution}/gi, institutionName)
    .replace(/{instituicao}/gi, institutionName);

  // O prompt do agente vem primeiro para que a persona seja respeitada
  const agentPersona = sanitizedUserPrompt?.trim()
    ? `## IDENTIDADE E MISSÃO DO AGENTE\n${sanitizedUserPrompt.trim()}`
    : '## IDENTIDADE E MISSÃO DO AGENTE\nVocê é um assistente virtual educacional prestativo e amigável.';

  const currentDateTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const contextInfo = [
    '## CONTEXTO DO ATENDIMENTO',
    `- Data e Hora Atuais (Horário de Brasília): ${currentDateTime}`,
    `- Instituição: ${institutionName}`,
    `- Nome do Lead: ${leadName}`,
    `- Telefone: ${leadPhone}`,
    '',
    `-> IMPORTANTE: Aja de maneira direta e continuada. NUNCA faça discursos de "Boas-vindas" ou "Como posso ajudar?" no meio de uma conversa. Responda exatamente à intenção do usuário.`
  ].join('\n');

  // Capacidades que a IA pode acionar
  const capabilities = [
    '## SUAS CAPACIDADES E REGRAS DE OURO',
    'Você pode ajudar o lead a realizar Matrículas e Agendamentos de Visitas.',
    '',
    '⚠️ REGRA DE FORMATACÃO (WHATSAPP)',
    '- No WhatsApp, o negrito é feito com APENAS UM asterisco. Exemplo: *texto*. NUNCA use dois asteriscos (**texto**).',
    '',
    '⚠️ REGRA DE OURO 1: PROATIVIDADE E CONSULTA',
    '- Antes de pedir qualquer dado, VALORIZE o interesse do lead.',
    '- Se o lead perguntar sobre um curso, PRIMEIRO explique os benefícios e detalhes usando a BASE DE CONHECIMENTO.',
    '',
    '⚠️ DISTINÇÃO CRÍTICA ENTRE VISITA E MATRÍCULA (NUNCA CONFUNDA AS DUAS)',
    '- AGENDAR VISITA: O visitante quer APENAS conhecer o espaço. É ESTRITAMENTE PROIBIDO pedir "nome completo", "telefone", "nome da criança", "idade" ou "qual curso" ao agendar uma visita. Você só precisa da DATA e HORA. SE VOCÊ PEDIR O NOME DA CRIANÇA PARA UMA VISITA, ISSO É UM ERRO GRAVE.',
    '- FAZER MATRÍCULA: O aluno vai efetivar a compra/matrícula no curso. SÓ NESTE CASO você exige nome completo do aluno, e-mail e turma.',
    '',
    '⚠️ REGRA DE OURO 2: COLETA INDIVIDUAL E FLUIDA',
    '- É ESTRITAMENTE PROIBIDO usar listas numeradas ("1.", "2.", etc.) ou bullets. Faça as perguntas de forma natural.',
    '- Peça apenas UM dado por vez.',
    '- Nunca peça o nome ou o telefone. Eles já estão explícitos no Contexto do Atendimento acima.',
    '',
    '⚠️ REGRA DE OURO 3: EXECUÇÃO DO AGENDAMENTO DE VISITA',
    '- OBRIGATÓRIO: Assim que o usuário disser o dia e horário que deseja, NÃO FAÇA PERGUNTAS EXTRAS (ex: "Qual unidade?"). Confirme brevemente e ACIONE a ferramenta IMEDIATAMENTE.',
    '- É OBRIGATÓRIO usar a sua capacidade de chamada de função (`register_visit`) para salvar a visita.',
    '- Se o seu sistema não lidar bem com chamadas de função nativas, retorne EXCLUSIVAMENTE o bloco de código JSON abaixo para o agendamento:',
    '```json',
    '{ "name": "register_visit", "arguments": { "lead_name": "[Nome do Lead]", "scheduled_at": "YYYY-MM-DDTHH:mm:ss-03:00" } }',
    '```',
    '- Use a "Data e Hora Atuais" do contexto para deduzir o ano, mês e dia.',
    '',
    '⚠️ REGRA ANTI-ALUCINAÇÃO (MANDATÓRIA)',
    '- NUNCA invente perguntas sobre "qual unidade", a não ser que tenha várias unidades descritas no seu contexto explícito.',
    '- NUNCA esqueça a data/horário que o usuário enviou nos turnos anteriores. Não pergunte de novo!',
    '- NUNCA INVENTE, ADIVINHE OU ASSUMA UMA DATA OU HORÁRIO se o usuário não falou.',
    '- NUNCA invente endereços, ruas, números de telefone, e-mails institucionais ou CNPJ fictícios.',
    '- Se o endereço ou telefone não constar na base, APENAS DIGA que a secretaria enviará a localização completa.',
    '- Se disser em texto que agendou, mas não engatilhar a ferramenta/JSON, você falhou.',
    '',
    '⚠️ REGRA DE SILÊNCIO DURANTE EXECUÇÃO (CRÍTICO)',
    '- NUNCA diga frases como "Agendado!", "Pronto!", "Já fiz" ou "Tudo certo" no MESMO turno em que você aciona a ferramenta `register_visit` ou `register_enrollment`.',
    '- Se você não enviou o bloco JSON, ESTÁ PROIBIDO de dizer que agendou.',
    '',
    '⚠️ REGRA DE OURO 4: EXECUÇÃO DE MATRÍCULA',
    '- Utilize a função `register_enrollment` apenas após obter os dados necessários (aluno, e-mail e turma).'
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
    contextInfo,
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
        'Agenda uma visita à instituição. OBRIGATÓRIO: Use SOMENTE DEPOIS que o usuário informar CLARAMENTE a data e a hora da visita. Se ele não informou ambos, não use esta ferramenta e pergunte o horário preferido.',
      parameters: {
        type: 'object',
        properties: {
          lead_name: { type: 'string', description: 'Nome do interessado' },
          lead_phone: { type: 'string', description: 'Telefone (já conhecido)' },
          scheduled_at: {
            type: 'string',
            description: 'Data e hora da visita OBRIGATORIAMENTE em formato ISO 8601 com o sufixo de fuso brasileiro (exemplo abstrato: YYYY-MM-DDTHH:mm:ss-03:00). Nunca esqueça do sufixo -03:00. Atenção ao Ano: cruze a "Data e Hora Atuais" do Contexto para deduzir o ano!',
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

      // TRAVA DE IDEMPOTÊNCIA: Evita agendamentos duplicados por retries da Evolution
      // Verifica se já existe um agendamento para este lead no mesmo minuto
      const schedDate = new Date(scheduled_at);
      const windowStart = new Date(schedDate.getTime() - 30 * 1000).toISOString(); // -30s
      const windowEnd = new Date(schedDate.getTime() + 30 * 1000).toISOString();   // +30s

      const { data: existing } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at')
        .eq('institution_id', institutionId)
        .eq('lead_id', leadId)
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', windowEnd)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Webhook] Idempotência: Agendamento já existe para ${lead_name} em ${scheduled_at}`);
        const dateFormatted = new Date(existing[0].scheduled_at).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        return `✅ Visita já estava agendada! ${lead_name}, confirmamos sua vinda para o dia ${dateFormatted}. Caso precise reagendar, conte comigo!`;
      }

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

      const greetingFormatted = agent.greeting_message
        .replace(/{nome}/gi, pushName)
        .replace(/{lead_name}/gi, pushName)
        .replace(/{institution}/gi, institution.name)
        .replace(/{instituicao}/gi, institution.name)
        .replace(/\[NOME DA INSTITUIÇÃO\]/gi, institution.name);

      await sendEvolutionMessage(
        evoUrl, evoKey, instanceName, phoneNumber,
        greetingFormatted,
        agent.enable_line_breaks ?? false,
        agent.response_delay_ms ?? 800
      );
      await supabaseAdmin.from('messages').insert({
        lead_id: lead.id,
        institution_id: institution.id,
        direction: 'outbound_ai',
        content: greetingFormatted,
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
    const fullSystemPrompt = buildSystemPrompt(
      agent.system_prompt || '', 
      commStyle, 
      knowledgeText,
      lead.name || 'Lead WhatsApp',
      phoneNumber,
      institution.name
    );

    const model: string = agent.ai_model_override || institution.ai_model || 'gpt-4o';
    const temperature: number = agent.temperature ?? 0.7;

    // Evita limite de tokens muito baixo que corta mensagens (Mínimo de 800)
    const dbMaxTokens = Number(agent.max_tokens);
    const maxTokens = (dbMaxTokens && dbMaxTokens > 100) ? Math.min(dbMaxTokens, 2000) : 800;

    console.log(`[Webhook] IA: ${provider}/${model} | Temp: ${temperature} | Tokens: ${maxTokens} | Estilo: ${commStyle}`);
    console.log(`[Webhook] System prompt (${fullSystemPrompt.length} chars) preview: "${fullSystemPrompt.substring(0, 150)}..."`);

    const customOpenAI = new OpenAI({ apiKey, baseURL });

    // 14. Chama a IA com Function Calling
    let botMessage: string;
    let totalTokensUsed = 0;

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

      // Acumula tokens da 1ª chamada (Extração Resiliente)
      const usage1 = aiResponse.usage;
      if (usage1) {
        const tokens = usage1.total_tokens || ((usage1.prompt_tokens || 0) + (usage1.completion_tokens || 0));
        if (tokens > 0) {
          totalTokensUsed += tokens;
          console.log(`[Webhook] Tokens (1ª chamada - ${model}): +${tokens}`);
        }
      } else {
        console.log(`[Webhook] Aviso: Uso de tokens não retornado na 1ª chamada para o modelo ${model}.`);
      }

      const choice = aiResponse.choices[0];

      let toolName = '';
      let toolArgs: Record<string, string> = {};
      let toolCallId = '';
      let hasToolCall = false;

      // 1) Verifica se a IA usou o formato nativo de tool_calls
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCall = choice.message.tool_calls[0] as any;
        toolName = toolCall.function.name as string;
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}') as Record<string, string>;
        } catch {
          toolArgs = {};
        }
        toolCallId = toolCall.id;
        hasToolCall = true;

        // Mute the raw string so it doesn't get sent back.
        // If the AI included "I'm scheduling" in the text, we don't want the user to see it yet.
        choice.message.content = null;
      }
      // 2) Fallback agressivo: Verifica se o modelo retornou raw text `<tool_call>` vazado ou JSON da tool.
      else if (choice.message?.content) {
        let parsed = null;
        const rawContent = choice.message.content;
        
        try {
          // Checa o padrão <tool_call> explícito
          const blockMatch = rawContent.match(/<tool_call>[\s\S]*?({[\s\S]+.*})/i);
          if (blockMatch && blockMatch[1]) {
            parsed = JSON.parse(blockMatch[1]);
          } else {
            // Tenta detectar `{ "name": "register_visit" ... }` no meio do texto bruto
            if (rawContent.includes('"register_visit"') || rawContent.includes('"register_enrollment"')) {
              const jsonMatch = rawContent.match(/```(?:json)?\n?([\s\S]*?)```/);
              if (jsonMatch && jsonMatch[1]) {
                 try {
                     parsed = JSON.parse(jsonMatch[1]);
                     if (Array.isArray(parsed)) parsed = parsed[0];
                 } catch (e) {
                     console.error('[Webhook] Failed to parse JSON block', e);
                 }
              }
              
              if (!parsed || (!parsed.name && !parsed.function)) {
                 const possibleJsonMatch = rawContent.match(/({[\s\S]*?"name"\s*:\s*"(?:register_visit|register_enrollment)"[\s\S]*})/i);
                 if (possibleJsonMatch && possibleJsonMatch[1]) {
                    try {
                        parsed = JSON.parse(possibleJsonMatch[1]);
                    } catch (e) {
                        console.error('[Webhook] Failed to parse possible JSON', e);
                    }
                 }
              }
            }
            
            // Tratamento extra caso o JSON use o formato nativo aninhado: { "function": { "name": ..., "arguments": ... } }
            if (parsed && parsed.function && parsed.function.name) {
                parsed = parsed.function;
            }
          }

          if (parsed && parsed.name && parsed.arguments) {
            if (parsed.name && parsed.arguments) {
              toolName = parsed.name;
              toolArgs = parsed.arguments;
              toolCallId = 'call_' + Date.now();
              hasToolCall = true;
              
              // Mute the raw string so it doesn't get sent back if fallback happens
              choice.message.content = null;
              choice.message.tool_calls = [{
                id: toolCallId,
                type: 'function',
                function: {
                  name: toolName,
                  arguments: JSON.stringify(toolArgs)
                }
              }];
            }
          }
        } catch (e) {
          console.error('[Webhook] Falha ao parsear <tool_call> manualmente do texto:', e);
        }
      }

      if (hasToolCall) {
        console.log(`[Webhook] Tool call detectado: ${toolName}`, toolArgs);

        // Completa o número de telefone nos args antes de salvar
        if (!toolArgs.student_phone && toolName === 'register_enrollment') {
          toolArgs.student_phone = phoneNumber;
        }
        if (!toolArgs.lead_phone && toolName === 'register_visit') {
          toolArgs.lead_phone = phoneNumber;
        }

        // Tenta normalizar a data para ISO caso venha em formato amigável
        if (toolArgs.scheduled_at) {
          try {
            const dateObj = new Date(toolArgs.scheduled_at);
            if (!isNaN(dateObj.getTime())) {
              toolArgs.scheduled_at = dateObj.toISOString();
            }
          } catch (e) {
             console.warn('[Webhook] Data inválida recebida da IA:', toolArgs.scheduled_at);
          }
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

        // Pede à IA para formatar uma resposta humana com o resultado do Tool
        const confirmationResponse = await customOpenAI.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...chatHistory,
            choice.message,
            {
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCallId,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        // Acumula tokens da 2ª chamada (Extração Resiliente)
        const usage2 = confirmationResponse.usage;
        if (usage2) {
          const tokens = usage2.total_tokens || ((usage2.prompt_tokens || 0) + (usage2.completion_tokens || 0));
          if (tokens > 0) {
            totalTokensUsed += tokens;
            console.log(`[Webhook] Tokens (Confirmação - ${model}): +${tokens}`);
          }
        }

        botMessage =
          confirmationResponse.choices[0]?.message?.content ||
          toolResult; // usa o resultado diretamente caso a confirmação falhe

        // Limpa possíveis tags raw do fallback
        botMessage = botMessage.replace(/<tool_call>[\s\S]*/g, '').trim() || toolResult;
      } else {
        botMessage = choice.message?.content || '';
        
        // Se ainda houver alguma tag <tool_call> residual quebrada que não virou tool, removemos pro usuário não ver
        botMessage = botMessage.replace(/<tool_call>[\s\S]*/g, '').trim();

        if (!botMessage.trim()) {
           botMessage = agent.fallback_message || 'Desculpe, tive um problema ao processar sua mensagem.';
        }
        
        // Interceptação de alucinação (Se confirmou agendamento mas não rodou a ferramenta, é alucinação)
        const lowerBotMsg = botMessage.toLowerCase();
        if ((lowerBotMsg.includes('agendada') || lowerBotMsg.includes('agendado') || lowerBotMsg.includes('marcad') || lowerBotMsg.includes('confirmado')) && 
            (lowerBotMsg.includes('visita') || lowerBotMsg.includes('horário') || lowerBotMsg.includes('dia'))) {
            botMessage = '⚠️ Tive um pequeno problema de sistema ao registrar no banco de dados. Para garantir, você me confirma o dia e a hora novamente, por favor?';
            console.warn('[Webhook] ALUCINAÇÃO INTERCEPTADA:', choice.message?.content);
        }
      }
    } catch (aiError: unknown) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('[Webhook] Erro ao chamar IA:', errMsg);
      botMessage =
        agent.fallback_message ||
        'Desculpe, estou com dificuldades no momento. Um atendente irá te ajudar em breve.';
    }

    console.log(`[Webhook] Resposta da IA: "${botMessage.substring(0, 100)}..."`);

    // 15a. Incrementa contador de tokens da instituição (fire-and-forget)
    if (totalTokensUsed > 0) {
      supabaseAdmin.rpc('increment_token_usage', {
        p_institution_id: institution.id,
        p_tokens: totalTokensUsed,
      }).then(({ error: rpcErr }) => {
        if (rpcErr) console.error('[Webhook] Erro ao atualizar token usage:', rpcErr.message);
        else console.log(`[Webhook] Tokens acumulados: +${totalTokensUsed} | Modelo: ${model}`);
      });
    }

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
