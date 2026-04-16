import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const reg = request.nextUrl.searchParams.get('reg');
  if (!reg) {
    return NextResponse.json(
      { data: null, error: 'Missing miner registration number' },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(`${BACKEND}/reports/miner/${encodeURIComponent(reg)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          data: null,
          error: `/reports/miner/${reg} returned ${response.status}${text ? `: ${text}` : ''}`,
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Miner reports API error:', error);
    return NextResponse.json(
      {
        data: null,
        error: 'Failed to fetch miner report data',
      },
      { status: 200 }
    );
  }
}
