import { NextResponse, NextRequest } from 'next/server';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const GLOBAL_KEY = process.env.EVOLUTION_GLOBAL_APIKEY || '';
const INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || '';
const ENV_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || '';

// Helper fetch para a Evolution API
async function evoFetch(path: string, options: RequestInit = {}) {
  const tokenToUse = INSTANCE_TOKEN || GLOBAL_KEY;

  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': tokenToUse,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    let instanceName = body.instanceName || ENV_INSTANCE_NAME;

    // Se temos um Nome e Token manuais, pulamos a criação e retornamos os dados
    if (action === 'create' && INSTANCE_TOKEN && ENV_INSTANCE_NAME) {
      return NextResponse.json({ 
        success: true, 
        manual: true, 
        instanceName: ENV_INSTANCE_NAME 
      });
    }

    if (!EVO_URL || (!GLOBAL_KEY && !INSTANCE_TOKEN)) {
      return NextResponse.json({ error: 'Configurações da Evolution não encontradas no .env.local' }, { status: 500 });
    }

    if (action === 'create') {
      const data = await evoFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      return NextResponse.json(data);
    }

    if (action === 'disconnect') {
      const data = await evoFetch(`/instance/logout/${instanceName}`, { method: 'DELETE' });
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
    const instance = searchParams.get('instance') || ENV_INSTANCE_NAME;

    if (action === 'config') {
      return NextResponse.json({ 
        manualMode: !!(INSTANCE_TOKEN && ENV_INSTANCE_NAME),
        instanceName: ENV_INSTANCE_NAME
      });
    }

    if (!EVO_URL || (!GLOBAL_KEY && !INSTANCE_TOKEN)) {
      return NextResponse.json({ error: 'Configurações da Evolution não configuradas' }, { status: 500 });
    }

    if (!instance) {
      return NextResponse.json({ error: 'Parâmetro instance obrigatório' }, { status: 400 });
    }

    if (action === 'qr') {
      const data = await evoFetch(`/instance/connect/${instance}`);
      return NextResponse.json(data); 
    }

    if (action === 'status') {
      const data = await evoFetch(`/instance/connectionState/${instance}`);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
