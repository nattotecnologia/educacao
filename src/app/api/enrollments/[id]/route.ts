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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  // Se cancelando a matrícula, decrementar vagas
  if (status === 'cancelled') {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('class_id, status')
      .eq('id', id)
      .eq('institution_id', institutionId)
      .single();

    if (enrollment && enrollment.status !== 'cancelled') {
      const { data: classData } = await supabase
        .from('classes')
        .select('filled_slots')
        .eq('id', enrollment.class_id)
        .single();

      if (classData && classData.filled_slots > 0) {
        await supabase
          .from('classes')
          .update({ filled_slots: classData.filled_slots - 1 })
          .eq('id', enrollment.class_id);
      }
    }
  }

  const { data, error } = await supabase
    .from('enrollments')
    .update(body)
    .eq('id', id)
    .eq('institution_id', institutionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
