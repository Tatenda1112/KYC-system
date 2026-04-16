import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.toString();

  try {
    const res = await fetch(
      `${BACKEND}/customers${query ? `?${query}` : ''}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ customers: [], error: text }, { status: 200 });
    }
    const customers = await res.json();
    return NextResponse.json({ customers, error: null });
  } catch (err) {
    console.error('Customers GET error:', err);
    return NextResponse.json({ customers: [], error: 'Failed to fetch customers' }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Customers POST error:', err);
    return NextResponse.json({ detail: 'Failed to create customer' }, { status: 500 });
  }
}
