import { NextResponse } from 'next/server';
import { getAllPlaces } from '@/lib/db';

export async function GET() {
  try {
    const places = await getAllPlaces();
    return NextResponse.json(places);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
