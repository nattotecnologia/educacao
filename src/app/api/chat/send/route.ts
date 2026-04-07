import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { rateLimit } from '@/utils/rate-limit';
import { decrypt } from '@/utils/encryption';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { success, remaining } = await rateLimit(request);
  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId, content } = await request.json();

    if (!leadId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Busca o lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, institutions(id, evolution_instance_name, evolution_api_key)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const instanceName = lead.institutions?.evolution_instance_name;
    if (!instanceName) {
      return NextResponse.json({ error: 'Evolution instance not configured' }, { status: 500 });
    }

    // Prepara para enviar na Evolution API
    const evoUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const instKeyNode = (lead.institutions as any)?.evolution_api_key;
    const decryptedEvoKey = instKeyNode ? decrypt(instKeyNode) : '';
    const evoKey = decryptedEvoKey || process.env.EVOLUTION_GLOBAL_APIKEY || '';

    const evoResponse = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoKey
      },
      body: JSON.stringify({
        number: lead.phone, // Formato esperado ex: 5511999999999 (tem que bater com como Evolution aceita, costuma ser JID ou numero limpo)
        text: content,
        delay: 500
      })
    });

    if (!evoResponse.ok) {
      const errorText = await evoResponse.text();
      console.error('Erro Evolution API:', errorText);
      return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 });
    }

    // Salva a mensagem como outbound_human no banco
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        lead_id: lead.id,
        institution_id: lead.institution_id,
        direction: 'outbound_human',
        content: content
      })
      .select()
      .single();

    if (msgError) {
      console.error('Erro ao salvar mensagem no DB:', msgError);
    }

    return NextResponse.json({ success: true, message });

  } catch (error: any) {
    console.error('Erro ao enviar mensagem:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
