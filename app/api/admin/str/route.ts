import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.toString();
    const res = await fetch(`${BACKEND}/customers/str/reports${q ? `?${q}` : ''}`, { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
