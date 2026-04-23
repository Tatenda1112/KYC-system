import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const query = request.nextUrl.searchParams.toString();
  const suffix = query ? `?${query}` : '';

  try {
    const { id } = await params;
    const res = await fetch(
      `${BACKEND}/customers/${id}/profile${suffix}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Customer profile GET error:', err);
    return NextResponse.json({ detail: 'Failed to fetch customer profile' }, { status: 500 });
  }
}
