import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { decrypt } from '@/utils/encryption';
import { z } from 'zod';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const GLOBAL_KEY = process.env.EVOLUTION_GLOBAL_APIKEY || '';
const INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || '';
const ENV_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || '';

// Helper fetch para a Evolution API com Timeout
async function evoFetch(path: string, apiKey: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

  try {
    const res = await fetch(`${EVO_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Evolution API Error] ${res.status}: ${text}`);
      throw new Error(`Evolution API request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Evolution API request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getInstitutionData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile?.institution_id) return null;

  const { data: inst } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', profile.institution_id)
    .single();

  return inst;
}

const postSchema = z.object({
  action: z.enum(['create', 'disconnect']),
  instanceName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const jsonBody = await req.json().catch(() => ({}));
    const parseResult = postSchema.safeParse(jsonBody);
    
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const { action, instanceName: parsedInstanceName } = parseResult.data;
    
    const inst = await getInstitutionData();
    let instKey = '';
    if (inst?.evolution_api_key) {
      try {
        instKey = decrypt(inst.evolution_api_key);
      } catch {
        console.warn('[Evolution] Falha ao decriptar evolution_api_key do banco — usando GLOBAL_APIKEY do .env');
      }
    }
    const apiKey = instKey || INSTANCE_TOKEN || GLOBAL_KEY;
    const instanceName = parsedInstanceName || inst?.evolution_instance_name || ENV_INSTANCE_NAME;

    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'null';
    console.log(`[Evolution] POST action=${body.action} | instance=${instanceName} | keySource=${instKey ? 'banco' : INSTANCE_TOKEN ? 'INSTANCE_TOKEN' : 'GLOBAL_KEY'} | key=${maskedKey}`);

    if (!EVO_URL || !apiKey) {
      return NextResponse.json({ error: 'Configurações da Evolution não encontradas' }, { status: 500 });
    }

    if (action === 'create') {
      // Se já temos modo manual no .env, retornamos sucesso sem criar de fato
      if (INSTANCE_TOKEN && ENV_INSTANCE_NAME && instanceName === ENV_INSTANCE_NAME) {
         return NextResponse.json({ success: true, manual: true, instanceName: ENV_INSTANCE_NAME });
      }

      try {
        const data = await evoFetch('/instance/create', apiKey, {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
        return NextResponse.json({ ...data, instanceName });
      } catch (evoErr: any) {
        const errMsg = evoErr.message || '';
        // 401, 403 e "already in use" = instância já existe e está ativa
        if (errMsg.includes('already in use') || errMsg.includes('403') || errMsg.includes('401')) {
          console.log(`[Evolution] Instância ${instanceName} já existe/conectada (${errMsg.includes('401') ? '401' : '403'}). Retornando sucesso.`);
          return NextResponse.json({ success: true, instanceName, message: 'Instance already exists' });
        }
        throw evoErr;
      }
    }

    if (action === 'disconnect') {
      const data = await evoFetch(`/instance/logout/${instanceName}`, apiKey, { method: 'DELETE' });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('[Evolution POST Error]:', err.message);
    return NextResponse.json({ error: 'Erro interno no processamento da ação' }, { status: 500 });
  }
}

const getSchema = z.object({
  action: z.enum(['config', 'qr', 'status']),
  instance: z.string().optional()
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const actionParam = searchParams.get('action');
    const instanceParam = searchParams.get('instance');
    
    const parseResult = getSchema.safeParse({ action: actionParam, instance: instanceParam || undefined });
    
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }
    const { action, instance: parsedInstance } = parseResult.data;
    
    const inst = await getInstitutionData();
    let instKey = '';
    if (inst?.evolution_api_key) {
      try {
        instKey = decrypt(inst.evolution_api_key);
      } catch {
        console.warn('[Evolution] Falha ao decriptar evolution_api_key do banco — usando GLOBAL_APIKEY do .env');
      }
    }
    const apiKey = instKey || INSTANCE_TOKEN || GLOBAL_KEY;
    const instanceName = parsedInstance || inst?.evolution_instance_name || ENV_INSTANCE_NAME;

    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'null';
    console.log(`[Evolution] GET action=${action} | instance=${instanceName} | keySource=${instKey ? 'banco' : INSTANCE_TOKEN ? 'INSTANCE_TOKEN' : 'GLOBAL_KEY'} | key=${maskedKey}`);

    if (action === 'config') {
      return NextResponse.json({ 
        manualMode: !!(INSTANCE_TOKEN && ENV_INSTANCE_NAME),
        instanceName: inst?.evolution_instance_name || ENV_INSTANCE_NAME
      });
    }

    if (!EVO_URL || !apiKey) {
      return NextResponse.json({ error: 'Configurações da Evolution não configuradas' }, { status: 500 });
    }

    if (!instanceName) {
      return NextResponse.json({ error: 'Parâmetro instance obrigatório' }, { status: 400 });
    }

    if (action === 'qr') {
      const data = await evoFetch(`/instance/connect/${instanceName}`, apiKey);
      return NextResponse.json(data); 
    }

    if (action === 'status') {
      const data = await evoFetch(`/instance/connectionState/${instanceName}`, apiKey);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('[Evolution GET Error]:', err.message);
    return NextResponse.json({ error: 'Erro interno ao consultar dados da Evolution' }, { status: 500 });
  }
}

