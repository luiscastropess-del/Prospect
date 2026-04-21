import { NextResponse } from 'next/server';
import { getPlacesLast24Hours } from '@/lib/db';
import { setResults } from '@/lib/memory';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const places = await getPlacesLast24Hours();
    
    // Restaurar a memória da API Result com esses resgistros
    if (places && places.length > 0) {
      setResults(places);
    }
    
    return NextResponse.json({ 
      message: `${places?.length || 0} locais restaurados para a API Result (últimas 24h)`,
      count: places?.length || 0 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao restaurar locais' }, { status: 500 });
  }
}

// Permite GET também para caso chamem via browser/ferramentas simples
export async function GET() {
  return POST();
}
