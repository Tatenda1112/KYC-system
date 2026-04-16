import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

async function fetchJson(path: string) {
  const response = await fetch(`${BACKEND}${path}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} returned ${response.status}${text ? `: ${text}` : ''}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const reg = request.nextUrl.searchParams.get('reg');
  if (!reg) {
    return NextResponse.json(
      { error: 'Missing miner registration number' },
      { status: 400 }
    );
  }

  try {
    const encodedReg = encodeURIComponent(reg);
    const [complianceResult, transactionsResult] = await Promise.allSettled([
      fetchJson(`/compliance/miner/${encodedReg}`),
      fetchJson(`/transactions?miner_reg_number=${encodedReg}`),
    ]);

    const compliance = complianceResult.status === 'fulfilled' ? complianceResult.value : null;
    const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];

    const errors = [
      complianceResult.status === 'rejected'
        ? `compliance: ${complianceResult.reason instanceof Error ? complianceResult.reason.message : 'failed'}`
        : null,
      transactionsResult.status === 'rejected'
        ? `transactions: ${transactionsResult.reason instanceof Error ? transactionsResult.reason.message : 'failed'}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return NextResponse.json({
      compliance,
      transactions,
      errors,
    });
  } catch (error) {
    console.error('Miner dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch miner dashboard data' },
      { status: 500 }
    );
  }
}
