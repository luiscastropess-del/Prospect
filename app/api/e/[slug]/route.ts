import { NextResponse } from 'next/server';
import { getSupabase, getPlacesByFilter } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = getSupabase();

    // 1. Buscar a configuração do endpoint
    const { data: endpoint, error: eError } = await supabase
      .from('endpoints')
      .select('*')
      .eq('slug', slug)
      .single();

    if (eError || !endpoint) {
      return NextResponse.json({ error: 'Endpoint não encontrado' }, { status: 404 });
    }

    // 2. Buscar locais filtrados
    const places = await getPlacesByFilter(
      endpoint.city,
      endpoint.state,
      endpoint.category,
      endpoint.results_limit
    );

    return NextResponse.json({
      metadata: {
        slug: endpoint.slug,
        city: endpoint.city,
        state: endpoint.state,
        category: endpoint.category,
        count: places.length,
        last_updated: new Date().toISOString()
      },
      places
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
