import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: camps, error: campsError } = await supabase.from('campaigns').select('id, name, status, institution_id');
  const { data: insts, error: instsError } = await supabase.from('institutions').select('id, name, evolution_instance_name, evolution_api_url');
  
  return NextResponse.json({ camps, campsError, insts, instsError });
}
