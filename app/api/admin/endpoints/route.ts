import { NextResponse } from 'next/server';
import { getAllEndpoints, createEndpoint, deleteEndpoint } from '@/lib/db';

export async function GET() {
  try {
    const endpoints = await getAllEndpoints();
    return NextResponse.json(endpoints);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, city, state, category, limit } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Slug é obrigatório' }, { status: 400 });
    }

    const newEndpoint = {
      slug,
      city: city || null,
      state: state || null,
      category: category || null,
      results_limit: limit || 50,
      created_at: new Date().toISOString()
    };

    const data = await createEndpoint(newEndpoint);
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    await deleteEndpoint(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
