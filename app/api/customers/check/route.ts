import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('query');
  const minerRegNumber = searchParams.get('miner_reg_number');

  if (!query) {
    return NextResponse.json({ detail: 'query is required' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ query });
    if (minerRegNumber) params.set('miner_reg_number', minerRegNumber);

    const res = await fetch(`${BACKEND}/customers/check?${params}`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(null);
    }
    // Backend returns null (204-like) when not found, or the customer object
    const text = await res.text();
    return NextResponse.json(text ? JSON.parse(text) : null);
  } catch (err) {
    console.error('Customer check error:', err);
    return NextResponse.json(null);
  }
}
