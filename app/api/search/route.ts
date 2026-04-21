import { NextRequest, NextResponse } from 'next/server';
import { performSearch } from '@/lib/search-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { city, category } = await req.json();
    if (!city || !category) {
      return NextResponse.json({ error: 'Cidade e categoria são obrigatórios' }, { status: 400 });
    }

    const results = await performSearch(city, category);
    return NextResponse.json({ message: `${results.length} locais processados`, count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno servidor' }, { status: 500 });
  }
}
