import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { decrypt } from '@/utils/encryption';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const GLOBAL_KEY = process.env.EVOLUTION_GLOBAL_APIKEY || '';
const INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || '';
const ENV_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || '';

// Helper fetch para a Evolution API
async function evoFetch(path: string, apiKey: string, options: RequestInit = {}) {
  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }
  return res.json();
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    
    const inst = await getInstitutionData();
    const instKey = inst?.evolution_api_key ? decrypt(inst.evolution_api_key) : '';
    const apiKey = instKey || INSTANCE_TOKEN || GLOBAL_KEY;
    const instanceName = body.instanceName || inst?.evolution_instance_name || ENV_INSTANCE_NAME;

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
        if (evoErr.message?.includes('already in use') || evoErr.message?.includes('403')) {
          console.log(`Instância ${instanceName} já existe na Evolution API, ignorando erro de criação.`);
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    const inst = await getInstitutionData();
    const instKey = inst?.evolution_api_key ? decrypt(inst.evolution_api_key) : '';
    const apiKey = instKey || INSTANCE_TOKEN || GLOBAL_KEY;
    const instanceName = searchParams.get('instance') || inst?.evolution_instance_name || ENV_INSTANCE_NAME;

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

