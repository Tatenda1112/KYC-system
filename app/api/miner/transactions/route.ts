import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const reg = request.nextUrl.searchParams.get('reg');
  if (!reg) {
    return NextResponse.json(
      { error: 'Missing miner registration number' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${BACKEND}/transactions?miner_reg_number=${encodeURIComponent(reg)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          transactions: [],
          error: `/transactions?miner_reg_number=${reg} returned ${response.status}${text ? `: ${text}` : ''}`,
        },
        { status: 200 }
      );
    }

    const transactions = await response.json();
    return NextResponse.json({ transactions, error: null });
  } catch (error) {
    console.error('Miner transactions API error:', error);
    return NextResponse.json(
      {
        transactions: [],
        error: 'Failed to fetch miner transactions data',
      },
      { status: 200 }
    );
  }
}
