import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log('Dados recebidos na API Final:', data);
    
    // Aqui você pode integrar com outros sistemas ou apenas registrar o sucesso
    return NextResponse.json({ success: true, message: 'Dados encaminhados com sucesso para a API Final.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
