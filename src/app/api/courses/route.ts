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
  const onlyActive = searchParams.get('active') !== 'false';

  let query = supabase
    .from('courses')
    .select('*, classes(count)')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });

  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, description, modality, duration_hours, price, is_active } = body;

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

  const { data, error } = await supabase
    .from('courses')
    .insert({ institution_id: institutionId, name, description, modality, duration_hours, price, is_active })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
