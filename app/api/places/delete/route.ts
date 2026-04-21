import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Lista de IDs inválida' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('places')
      .delete()
      .in('osm_id', ids);

    if (error) throw error;

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error('Erro na limpeza do banco:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
