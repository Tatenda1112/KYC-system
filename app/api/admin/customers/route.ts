import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.toString();

  try {
    const res = await fetch(
      `${BACKEND}/customers/admin${query ? `?${query}` : ''}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ customers: [], error: text }, { status: 200 });
    }
    const customers = await res.json();
    return NextResponse.json({ customers, error: null });
  } catch (err) {
    console.error('Admin customers GET error:', err);
    return NextResponse.json({ customers: [], error: 'Failed to fetch customers' }, { status: 200 });
  }
}
