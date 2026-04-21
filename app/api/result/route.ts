import { NextResponse } from 'next/server';
import { getResults } from '@/lib/memory';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = getResults();
  return NextResponse.json(results);
}
