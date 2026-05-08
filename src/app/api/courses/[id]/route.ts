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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('courses')
    .select('*, classes(*)')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Curso não encontrado.' }, { status: 404 });

  // Se for gratuito, ignora desconto
  if (data.price === 0 || data.price == null) {
    return NextResponse.json(data);
  }

  // Busca promoções ativas da instituição
  const { data: promotionsData } = await supabase
    .from('promotions')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('is_active', true);

  const now = new Date();
  const activePromotions = (promotionsData || []).filter((p: any) => {
    if (!p.valid_until) return true;
    return new Date(p.valid_until) >= now;
  });

  const globalPromotions = activePromotions.filter((p: any) => !p.course_id);
  const globalPromo = globalPromotions.length > 0 ? globalPromotions[0] : null;
  const specificPromo = activePromotions.find((p: any) => p.course_id === data.id);
  
  const appliedPromo = specificPromo || globalPromo;

  let finalData = { ...data };

  if (appliedPromo) {
    let discountAmount = 0;
    if (appliedPromo.discount_percentage) {
      discountAmount = data.price * (appliedPromo.discount_percentage / 100);
    } else if (appliedPromo.discount_value) {
      discountAmount = appliedPromo.discount_value;
    }

    if (discountAmount > 0) {
      finalData = {
        ...data,
        original_price: data.price,
        price: Math.max(0, data.price - discountAmount),
        active_promotion: appliedPromo.name
      };
    }
  }

  return NextResponse.json(finalData);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('courses')
    .update(body)
    .eq('id', id)
    .eq('institution_id', institutionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const institutionId = await getInstitutionId(request);
  if (!institutionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('institution_id', institutionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
