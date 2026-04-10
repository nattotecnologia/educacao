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
  const classId = searchParams.get('class_id');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  let query = supabase
    .from('enrollments')
    .select('*, classes(name, courses(name)), leads(name, phone)', { count: 'exact' })
    .eq('institution_id', institutionId)
    .order('enrolled_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (classId) query = query.eq('class_id', classId);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { class_id, lead_id, student_name, student_email, student_phone, student_cpf, notes } = body;

  if (!class_id || !student_name) {
    return NextResponse.json({ error: 'class_id e nome do aluno são obrigatórios.' }, { status: 400 });
  }

  // Verificar vagas disponíveis
  const { data: classData } = await supabase
    .from('classes')
    .select('total_slots, filled_slots, status')
    .eq('id', class_id)
    .eq('institution_id', institutionId)
    .single();

  if (!classData) return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });
  if (classData.status !== 'open') return NextResponse.json({ error: 'Turma não está aberta para matrículas.' }, { status: 400 });
  if (classData.filled_slots >= classData.total_slots) return NextResponse.json({ error: 'Turma sem vagas disponíveis.' }, { status: 400 });

  // Criar matrícula
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({ institution_id: institutionId, class_id, lead_id: lead_id || null, student_name, student_email, student_phone, student_cpf, notes })
    .select()
    .single();

  if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });

  // Incrementar filled_slots
  await supabase
    .from('classes')
    .update({ filled_slots: classData.filled_slots + 1 })
    .eq('id', class_id);

  // Atualizar status do lead para converted (se fornecido)
  if (lead_id) {
    await supabase.from('leads').update({ status: 'converted' }).eq('id', lead_id);
  }

  return NextResponse.json(enrollment, { status: 201 });
}
