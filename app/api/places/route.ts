import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const places = await db`SELECT * FROM places ORDER BY last_updated DESC`;
    return NextResponse.json(places);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
