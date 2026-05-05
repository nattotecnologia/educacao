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
  institutionName: string,
  businessHours: any[] = [],
  closedDays: any[] = []
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

  // Gerador de Calendário Dinâmico (Próximos 14 Dias) para evitar alucinações de data/dia da IA
  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const upcomingCalendar = [];
  
  for (let i = 0; i <= 14; i++) {
    const d = new Date();
    d.setHours(d.getHours() - 3); // Fuso horário do Brasil
    d.setDate(d.getDate() + i);
    
    const dayOfWeekStr = daysOfWeek[d.getDay()];
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = dateStr.split('-').reverse().join('/');
    
    const closedReason = closedDays?.find(cd => cd.date === dateStr);
    const bh = businessHours?.find(b => Number(b.day) === d.getDay());
    const isOpen = bh?.isOpen;
    
    if (closedReason) {
      upcomingCalendar.push(`- ${displayDate} (${dayOfWeekStr}): FECHADO (Feriado: ${closedReason.reason})`);
    } else if (!isOpen) {
      upcomingCalendar.push(`- ${displayDate} (${dayOfWeekStr}): FECHADO`);
    } else {
      upcomingCalendar.push(`- ${displayDate} (${dayOfWeekStr}): ABERTO (das ${bh.open} às ${bh.close})`);
    }
  }

  // Capacidades que a IA pode acionar
  const capabilities = [
    '## SUAS CAPACIDADES E REGRAS DE OURO',
    'Você pode ajudar o lead a realizar Matrículas e Agendamentos de Visitas. Você também pode LISTAR, CANCELAR e REAGENDAR visitas existentes.',
    '',
    '⚠️ REGRA DE FORMATACÃO (WHATSAPP)',
    '- No WhatsApp, o negrito é feito com APENAS UM asterisco. Exemplo: *texto*. NUNCA use dois asteriscos (**texto**).',
    '',
    '⚠️ GERENCIAMENTO DE VISITAS EXISTENTES',
    '- Se o lead perguntar sobre seus agendamentos, use `list_visits` para buscar a lista.',
    '- Ao listar as visitas para o lead, seja cordial e mostre as datas de forma amigável.',
    '- Se o lead quiser cancelar ou reagendar, você DEVE sempre usar `list_visits` primeiro para obter o ID da visita, a menos que o ID já tenha sido mencionado explicitamente na conversa.',
    '- Use o ID curto (8 caracteres) fornecido por `list_visits` para identificar a visita.',
    '- NUNCA cancele ou reagende sem confirmar com o lead qual visita ele quer alterar e pedir autorização final.',
    '- IMPORTANTE: Ao pedir confirmação, mencione sempre o ID curto da visita (ex: "para a visita de ID abc12345"). Isso garante que você não perca a referência no próximo turno.',
    '',
    '⚠️ REGRA DE OURO: CONFIRMAÇÃO OBRIGATÓRIA (MANDATÓRIA)',
    '- Antes de executar QUALQUER ferramenta de escrita (register_visit, register_enrollment, cancel_visit, reschedule_visit), você DEVE resumir os dados para o usuário (incluindo o ID da visita se for cancelamento/reagendamento) e perguntar: "Está correto? Posso prosseguir?".',
    '- Só execute a ferramenta se o usuário responder afirmativamente (ex: "Sim", "Pode", "Tudo certo").',
    '',
    '⚠️ REGRA DE OURO 1: PROATIVIDADE E CONSULTA',
    '- Antes de pedir qualquer dado, VALORIZE o interesse do lead.',
    '- Se o lead perguntar sobre um curso, PRIMEIRO explique os benefícios e detalhes usando a BASE DE CONHECIMENTO.',
    '',
    '⚠️ DISTINÇÃO CRÍTICA ENTRE VISITA E MATRÍCULA (NUNCA CONFUNDA AS DUAS)',
    '- AGENDAR VISITA: O visitante quer APENAS conhecer o espaço. É ESTRITAMENTE PROIBIDO pedir "nome completo", "telefone", "nome da criança", "idade" ou "qual curso" ao agendar uma visita. Você só precisa da DATA e HORA. SE VOCÊ PEDIR O NOME DA CRIANÇA PARA UMA VISITA, ISSO É UM ERRO GRAVE.',
    '- FAZER MATRÍCULA: O aluno vai efetivar a compra/matrícula no curso. SÓ NESTE CASO você exige nome completo do aluno, e-mail e turma.',
    '',
    '⚠️ REGRAS DE AGENDAMENTO (LEIA COM ATENÇÃO MÁXIMA)',
    'Para agendar, VOCÊ DEVE SE BASEAR ÚNICA E EXCLUSIVAMENTE no calendário abaixo. Não tente adivinhar dias da semana ou feriados.',
    '## CALENDÁRIO DE DISPONIBILIDADE (PRÓXIMOS 14 DIAS):',
    upcomingCalendar.join('\n'),
    '',
    '- IMPORTANTE: NUNCA sugira ou aceite um agendamento para um dia que esteja marcado como FECHADO acima.',
    '- IMPORTANTE: Se o usuário pedir um horário em um dia FECHADO, informe amigavelmente o motivo e sugira o PRÓXIMO dia listado como ABERTO no calendário.',
    '- IMPORTANTE: Se o horário pedido estiver fora da faixa do dia ABERTO, avise e sugira um horário válido dentro da faixa permitida.',

    '⚠️ REGRA DE OURO 2: COLETA INDIVIDUAL E FLUIDA',
    '- É ESTRITAMENTE PROIBIDO usar listas numeradas ("1.", "2.", etc.) ou bullets. Faça as perguntas de forma natural.',
    '- Peça apenas UM dado por vez.',
    '- Nunca peça o nome ou o telefone. Eles já estão explícitos no Contexto do Atendimento acima.',
    '',
    '⚠️ REGRA DE OURO 3: EXECUÇÃO DO AGENDAMENTO DE VISITA',
    '- PASSO 1: Assim que o usuário disser o dia e horário, resuma a solicitação e pergunte se pode agendar.',
    '- PASSO 2: Somente após a confirmação do usuário, use a ferramenta `register_visit` para salvar.',
    '- Se o seu sistema não lidar bem com chamadas de função nativas, retorne EXCLUSIVAMENTE o bloco de código JSON abaixo para o agendamento:',
    '```json',
    '{ "name": "register_visit", "arguments": { "lead_name": "[Nome do Lead]", "scheduled_at": "YYYY-MM-DDTHH:mm:00" } }',
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
    '- Somente após obter os dados necessários (aluno, e-mail e turma), apresente um resumo e peça confirmação antes de usar `register_enrollment`.'
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
        'Registra a matrícula de um aluno em uma turma. Use SOMENTE APÓS o usuário confirmar explicitamente os dados resumidos por você.',
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
        'Agenda uma visita à instituição. OBRIGATÓRIO: Use SOMENTE DEPOIS que o usuário confirmar explicitamente o resumo da data e hora enviado por você.',
      parameters: {
        type: 'object',
        properties: {
          lead_name: { type: 'string', description: 'Nome do interessado' },
          lead_phone: { type: 'string', description: 'Telefone (já conhecido)' },
          scheduled_at: {
            type: 'string',
            description: 'Data e hora da visita. OBRIGATÓRIO: Coloque EXATAMENTE o número da hora que o usuário pediu no formato YYYY-MM-DDTHH:mm:00. NUNCA some ou subtraia horários. NÃO coloque sufixo de fuso horário (nem Z, nem -03:00). Apenas a hora pura.',
          },
          notes: { type: 'string', description: 'Observações ou interesses do visitante (opcional)' },
        },
        required: ['lead_name', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_visits',
      description:
        'Busca e lista todas as visitas agendadas (ativas ou passadas) associadas ao lead. Use sempre que o lead perguntar "quais meus agendamentos", "quando é minha visita", ou demonstrar dúvida sobre o horário marcado.',
      parameters: {
        type: 'object',
        properties: {
          include_past: {
            type: 'boolean',
            description: 'Se true, inclui visitas passadas. Por padrão só retorna futuras.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_visit',
      description:
        'Cancela uma visita agendada. Use SOMENTE após o usuário confirmar explicitamente que deseja cancelar a visita específica identificada.',
      parameters: {
        type: 'object',
        properties: {
          visit_id: { type: 'string', description: 'ID da visita a cancelar (obtido via list_visits)' },
        },
        required: ['visit_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_visit',
      description:
        'Reagenda uma visita existente para uma nova data e hora. Use SOMENTE após o usuário confirmar explicitamente os novos dados de data/hora resumidos por você.',
      parameters: {
        type: 'object',
        properties: {
          visit_id: { type: 'string', description: 'ID da visita a reagendar (obtido via list_visits)' },
          new_scheduled_at: {
            type: 'string',
            description: 'Nova data e hora no formato YYYY-MM-DDTHH:mm:00. NUNCA adicione sufixo de fuso horário.',
          },
        },
        required: ['visit_id', 'new_scheduled_at'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Execute tool calls returned by the AI
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  institutionId: string,
  leadId: string | null,
  phone: string,
  classes: ClassRow[]
): Promise<string> {
  // ── list_visits ──────────────────────────────────────────────────────────
  if (toolName === 'list_visits') {
    if (!leadId) return '❌ Não consegui identificar seu cadastro para buscar os agendamentos.';

    const includePast = args.include_past === true || args.include_past === 'true';

    // Os agendamentos estão salvos com a hora local + Z (ex: 14:00 local vira 14:00Z)
    // Precisamos comparar com o "agora" também na hora local + Z para não ocultar
    // agendamentos devido à diferença de fuso horário.
    const nowSp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const nowLocalIso = nowSp.getFullYear() + '-' + 
      String(nowSp.getMonth() + 1).padStart(2, '0') + '-' + 
      String(nowSp.getDate()).padStart(2, '0') + 'T' + 
      String(nowSp.getHours()).padStart(2, '0') + ':' + 
      String(nowSp.getMinutes()).padStart(2, '0') + ':' + 
      String(nowSp.getSeconds()).padStart(2, '0') + 'Z';

    let query = supabase
      .from('visit_appointments')
      .select('id, scheduled_at, status, notes')
      .eq('lead_id', leadId)
      .eq('institution_id', institutionId)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (!includePast) {
      query = query.gte('scheduled_at', nowLocalIso);
    }

    const { data: visits, error } = await query;

    if (error) {
      console.error('[Webhook] Erro ao listar visitas:', error.message);
      return '❌ Tive um problema ao buscar seus agendamentos. Tente novamente.';
    }

    if (!visits || visits.length === 0) {
      return 'ℹ️ Você não possui visitas agendadas no momento.';
    }

    const statusLabels: Record<string, string> = {
      scheduled: '🕐 Agendada',
      confirmed: '✅ Confirmada',
      done: '🎓 Realizada',
      cancelled: '❌ Cancelada',
      no_show: '😔 Não compareceu',
    };

    const lines = visits.map((v) => {
      const [year, month, day, hour, min] = v.scheduled_at.substring(0, 16).split(/[-T:]/);
      const dateStr = `${day}/${month}/${year} às ${hour}:${min}`;
      const statusLabel = statusLabels[v.status] || v.status;
      const shortId = v.id.substring(0, 8);
      return `• *${dateStr}* — ${statusLabel} (ID: ${shortId})`;
    });

    return `📅 Seus agendamentos:\n\n${lines.join('\n')}\n\nSe quiser cancelar ou reagendar, me informe o ID ou a data da visita.`;
  }

  // ── cancel_visit ─────────────────────────────────────────────────────────
  if (toolName === 'cancel_visit') {
    const { visit_id } = args;
    if (!visit_id) return '❌ Preciso do ID da visita para cancelar.';

    // Busca a visita (suporta ID completo ou prefixo parcial)
    let visitToCancel = null;

    if (visit_id.length !== 36) {
      if (!leadId) return '❌ Erro interno: Lead não identificado para busca parcial.';
      const { data: leadVisits, error: leadErr } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at, status')
        .eq('institution_id', institutionId)
        .eq('lead_id', leadId);
        
      if (!leadErr && leadVisits) {
        const targetId = visit_id.trim().toLowerCase();
        const matched = leadVisits.filter(v => v.id.toLowerCase().startsWith(targetId));
        if (matched.length === 0) return `❌ Não encontrei nenhuma visita do seu cadastro que comece com o ID "${visit_id}". Por favor, verifique se o ID está correto.`;
        if (matched.length > 1) return `⚠️ Encontrei ${matched.length} visitas com IDs similares. Por favor, use o ID completo ou informe a data exata.`;
        visitToCancel = matched[0];
      } else {
        return `❌ Erro ao acessar seus agendamentos: ${leadErr?.message || 'Erro desconhecido'}`;
      }
    } else {
      const { data: visits, error: findErr } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at, status')
        .eq('institution_id', institutionId)
        .eq('id', visit_id);
        
      if (findErr || !visits || visits.length === 0) return '❌ Visita não encontrada ou sem permissão para cancelar.';
      visitToCancel = visits[0];
    }

    if (!visitToCancel) return '❌ Visita não encontrada ou sem permissão para cancelar.';

    const visit = visitToCancel;
    if (visit.status === 'cancelled') return 'ℹ️ Esta visita já estava cancelada.';
    if (visit.status === 'done') return '❌ Não é possível cancelar uma visita que já foi realizada.';

    const { error } = await supabase
      .from('visit_appointments')
      .update({ status: 'cancelled' })
      .eq('id', visit.id);

    if (error) {
      console.error('[Webhook] Erro ao cancelar visita:', error.message);
      return '❌ Ocorreu um erro ao cancelar. Por favor, tente novamente.';
    }

    const [year, month, day, hour, min] = visit.scheduled_at.substring(0, 16).split(/[-T:]/);
    return `✅ Visita do dia *${day}/${month}/${year} às ${hour}:${min}* cancelada com sucesso. Se quiser agendar uma nova data, é só me chamar!`;
  }

  // ── reschedule_visit ──────────────────────────────────────────────────────
  if (toolName === 'reschedule_visit') {
    const { visit_id, new_scheduled_at } = args;
    if (!visit_id || !new_scheduled_at) return '❌ Preciso do ID da visita e do novo horário para reagendar.';

    // Busca a visita (suporta ID completo ou prefixo parcial)
    let visitToReschedule = null;

    if (visit_id.length !== 36) {
      if (!leadId) return '❌ Erro interno: Lead não identificado para busca parcial.';
      const { data: leadVisits, error: leadErr } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at, status')
        .eq('institution_id', institutionId)
        .eq('lead_id', leadId);
        
      if (!leadErr && leadVisits) {
        const targetId = visit_id.trim().toLowerCase();
        const matched = leadVisits.filter(v => v.id.toLowerCase().startsWith(targetId));
        if (matched.length === 0) return `❌ Não encontrei nenhuma visita do seu cadastro que comece com o ID "${visit_id}". Por favor, verifique se o ID está correto.`;
        if (matched.length > 1) return `⚠️ Encontrei ${matched.length} visitas com IDs similares. Por favor, use o ID completo ou informe a data exata.`;
        visitToReschedule = matched[0];
      } else {
        return `❌ Erro ao acessar seus agendamentos: ${leadErr?.message || 'Erro desconhecido'}`;
      }
    } else {
      const { data: visits, error: findErr } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at, status')
        .eq('institution_id', institutionId)
        .eq('id', visit_id);
        
      if (findErr || !visits || visits.length === 0) return '❌ Visita não encontrada ou sem permissão para reagendar.';
      visitToReschedule = visits[0];
    }

    if (!visitToReschedule) return '❌ Visita não encontrada ou sem permissão para reagendar.';

    const visit = visitToReschedule;
    if (visit.status === 'cancelled') return '❌ Não é possível reagendar uma visita já cancelada. Posso criar uma nova?';
    if (visit.status === 'done') return '❌ Não é possível reagendar uma visita que já foi realizada.';

    // Normaliza a data (remove sufixos de fuso horário se existirem, mantendo o padrão local + Z)
    const localTimeString = new_scheduled_at.includes('T') 
      ? new_scheduled_at.split('.')[0].substring(0, 19)
      : new_scheduled_at;
    
    const newDateUtc = localTimeString.endsWith('Z') ? localTimeString : localTimeString + 'Z';

    const { error } = await supabase
      .from('visit_appointments')
      .update({ scheduled_at: newDateUtc, status: 'scheduled' })
      .eq('id', visit.id);

    if (error) {
      console.error('[Webhook] Erro ao reagendar visita:', error.message);
      return '❌ Ocorreu um erro ao reagendar. Por favor, tente novamente.';
    }

    const [year, month, day, hour, min] = localTimeString.split(/[-T:]/);
    return `✅ Visita reagendada com sucesso! Te esperamos no dia *${day}/${month}/${year} às ${hour}:${min}*. Qualquer dúvida, estou aqui! 😊`;
  }

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

      // O AI manda algo como "2026-04-16T14:00:00-03:00". Para manter '14:00' exato no banco (sem saltar 3h por causa de UTC), pegamos apenas a data/hora local.
      const localTimeString = scheduled_at.substring(0, 19); // YYYY-MM-DDTHH:mm:ss

      // Verifica idempotência
      const schedTime = new Date(localTimeString + 'Z').getTime();
      const windowStart = new Date(schedTime - 30 * 1000).toISOString().substring(0, 19) + 'Z';
      const windowEnd = new Date(schedTime + 30 * 1000).toISOString().substring(0, 19) + 'Z';

      const { data: existing } = await supabase
        .from('visit_appointments')
        .select('id, scheduled_at')
        .eq('institution_id', institutionId)
        .eq('lead_id', leadId)
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', windowEnd)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Webhook] Idempotência: Agendamento já existe para ${lead_name} em ${localTimeString}`);
        const dateObj = new Date(existing[0].scheduled_at);
        const dateFormatted = dateObj.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        return `✅ Visita já estava agendada! ${lead_name}, confirmamos sua vinda para o dia ${dateFormatted}. Caso precise reagendar, conte comigo!`;
      }

      const { error } = await supabase.from('visit_appointments').insert({
        institution_id: institutionId,
        lead_id: leadId || null,
        lead_name,
        lead_phone: lead_phone || phone,
        scheduled_at: localTimeString + 'Z', // Força banco a travar no horário cravado
        notes: notes || null,
        status: 'scheduled',
      });

      if (error) {
        console.error('[Webhook] Erro ao registrar visita:', error.message);
        return '❌ Não consegui registrar sua visita. Por favor, tente novamente ou ligue para nós.';
      }

    // Formata a data de forma amigável com fuso correto
    const dateObjFormat = new Date();
    const [year, month, day, hour, min] = localTimeString.split(/[-T:]/);
    dateObjFormat.setFullYear(Number(year), Number(month) - 1, Number(day));
    dateObjFormat.setHours(Number(hour), Number(min), 0);
    
    // Fallback amigável simples
    const dateFormatted = `${day}/${month}/${year}, ${hour}:${min}`;

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
  
  // Garante que o evoUrl nunca fique vazio e quebre o fetch
  const validEvoUrl = evoUrl || process.env.EVOLUTION_API_URL || 'https://evo.nattotecnologia.cloud';

  try {
    if (enableLineBreaks) {
      const parts = text
        .split('\n\n') // Split only on double newlines for separate bubbles
        .map((p) => p.trim())
        .filter(Boolean);

      console.log(`[Webhook] Quebra de linha ATIVA — ${parts.length} parte(s)`);

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
    console.error('[Webhook] Erro ao enviar mensagem para a Evolution API:', error);
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

    // 4. Busca o Agente de IA para associar ao lead se necessário
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

    // 5. Busca ou cria o Lead
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
          ai_agent_id: agent?.id 
        })
        .select()
        .single();
      if (leadError) console.error('[Webhook] Erro ao registrar lead:', leadError.message);
      lead = newLead;
    } else if (!lead.ai_agent_id && agent) {
      // Se o lead já existe mas não tem agente associado, associa agora
      const { data: updatedLead } = await supabaseAdmin
        .from('leads')
        .update({ ai_agent_id: agent.id, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .select()
        .single();
      if (updatedLead) lead = updatedLead;
    }

    if (!lead) return NextResponse.json({ error: 'Lead_Not_Created' }, { status: 500 });
    console.log(`[Webhook] Lead: ${lead.name} (ID: ${lead.id})`);

    // 6. Salva a mensagem recebida IMEDIATAMENTE (para evitar perda em caso de timeout da IA)
    await supabaseAdmin.from('messages').insert({
      lead_id: lead.id,
      institution_id: institution.id,
      direction: 'inbound',
      content: incomingText,
    });
    console.log(`[Webhook] Mensagem 'inbound' salva com sucesso.`);

    // 6. Verifica atendimento humano
    if (lead.status === 'human_handling') {
      console.log(`[Webhook] Atendimento humano ativo para ${lead.name}. IA ignorando.`);
      return NextResponse.json({ success: true, ai_handled: false, reason: 'human_handling' });
    }

    // O 'agent' já foi declarado acima na linha 706.
    if (!agent) {
      console.warn('[Webhook] Nenhum agente ativo encontrado.');
      return NextResponse.json({ success: true, reason: 'no_active_agent' });
    }

    console.log(`[Webhook] Agente: "${agent.name}" | Papel: ${agent.agent_role || 'custom'} | is_default: ${!!defaultAgent}`);


    // 8. Prepara Evolution API
    const evoUrl = (institution.evolution_api_url || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const decryptedEvoKey = institution.evolution_api_key ? decrypt(institution.evolution_api_key) : null;
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

    // 10. Resolve API Key da IA (Correção de tipagem para Vercel)
    const provider: string = institution.ai_provider || 'openai';
    let apiKey: string | undefined;

    if (provider === 'openai') {
      apiKey = (institution.openai_key ? decrypt(institution.openai_key) : undefined) || process.env.OPENAI_API_KEY;
    } else if (provider === 'groq') {
      apiKey = (institution.groq_key ? decrypt(institution.groq_key) : undefined) || process.env.GROQ_API_KEY;
    } else if (provider === 'openrouter') {
      apiKey = (institution.openrouter_key ? decrypt(institution.openrouter_key) : undefined) || process.env.OPENROUTER_API_KEY;
    } else {
      apiKey = (institution.ai_api_key ? decrypt(institution.ai_api_key) : undefined);
    }
    
    if (!apiKey) {
      console.error('[Webhook] API Key não encontrada para o provedor:', provider);
      return NextResponse.json({ success: true, reason: 'no_api_key_for_provider' });
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
      institution.name,
      institution.business_hours,
      institution.closed_days
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
      console.error('[Webhook] ERRO NA CHAMADA DA IA:', errMsg);
      
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

    // 16. Atualiza o updated_at do lead para subir no chat
    await supabaseAdmin
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', lead.id);

    console.log(`[Webhook] ✅ Mensagem enviada para ${phoneNumber}`);
    return NextResponse.json({ success: true, ai_handled: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[Webhook] ERRO CRÍTICO:', errMsg);
    return NextResponse.json({ error: 'Internal_Server_Error', details: errMsg }, { status: 500 });
  }
}
