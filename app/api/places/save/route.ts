import { NextResponse } from 'next/server';
import { upsertPlaces } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { places } = await req.json();

    if (!places || !Array.isArray(places)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    await upsertPlaces(places);

    return NextResponse.json({ success: true, message: 'Dados salvos com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao salvar locais:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
