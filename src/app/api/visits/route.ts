import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getInstitutionId(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();
  return profile?.institution_id ?? null;
}

export async function GET(request: NextRequest) {
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('visit_appointments')
    .select('*, leads(name, phone)')
    .eq('institution_id', institutionId)
    .order('scheduled_at', { ascending: true });

  if (status) query = query.eq('status', status);
  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { lead_id, lead_name, lead_phone, scheduled_at, notes, assigned_to } = body;

  if (!lead_name || !scheduled_at) {
    return NextResponse.json({ error: 'Nome do lead e data são obrigatórios.' }, { status: 400 });
  }

  const appointmentDate = new Date(scheduled_at);
  const now = new Date();

  if (appointmentDate < now) {
    return NextResponse.json({ error: 'Não é possível agendar visitas em datas ou horários passados.' }, { status: 400 });
  }

  const minutes = appointmentDate.getMinutes();
  if (minutes !== 0 && minutes !== 30) {
    return NextResponse.json({ error: 'O agendamento deve ser feito em intervalos de 30 minutos (ex: 14:00, 14:30).' }, { status: 400 });
  }

  let targetLeadId = lead_id;

  if (!targetLeadId) {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({ 
        institution_id: institutionId, 
        name: lead_name, 
        phone: lead_phone 
      })
      .select()
      .single();
    
    if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
    targetLeadId = newLead.id;
  }

  const { data, error } = await supabase
    .from('visit_appointments')
    .insert({ 
      institution_id: institutionId, 
      lead_id: targetLeadId, 
      lead_name, 
      lead_phone, 
      scheduled_at, 
      notes, 
      assigned_to: assigned_to || null 
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
