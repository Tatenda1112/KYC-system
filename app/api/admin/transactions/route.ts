import { NextResponse } from 'next/server';

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

export async function GET() {
  try {
    const [statsResult, transactionsResult] = await Promise.allSettled([
      fetchJson('/transactions/stats'),
      fetchJson('/transactions'),
    ]);

    const stats =
      statsResult.status === 'fulfilled'
        ? statsResult.value
        : {
            total_transactions: 0,
            total_value_usd: 0,
            flagged_count: 0,
            cdd_incomplete_count: 0,
          };

    const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];

    const errors = [
      statsResult.status === 'rejected'
        ? `stats: ${statsResult.reason instanceof Error ? statsResult.reason.message : 'failed'}`
        : null,
      transactionsResult.status === 'rejected'
        ? `transactions: ${transactionsResult.reason instanceof Error ? transactionsResult.reason.message : 'failed'}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return NextResponse.json({
      stats,
      transactions,
      errors,
    });
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions data' },
      { status: 500 }
    );
  }
}
