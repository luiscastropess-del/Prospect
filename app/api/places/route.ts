import { NextResponse } from 'next/server';
import { getAllPlaces } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const places = await getAllPlaces();
    return NextResponse.json(places);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
