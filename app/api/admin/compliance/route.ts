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
    const [overviewResult, minersResult, alertsResult] = await Promise.allSettled([
      fetchJson('/compliance/overview'),
      fetchJson('/compliance/miners'),
      fetchJson('/compliance/alerts'),
    ]);

    const overview =
      overviewResult.status === 'fulfilled'
        ? overviewResult.value
        : {
            total_miners: 0,
            average_score: 0,
            kyc_distribution: {},
            risk_distribution: {},
            total_transactions: 0,
            flagged_transactions: 0,
          };

    const miners = minersResult.status === 'fulfilled' ? minersResult.value : [];
    const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];

    const errors = [
      overviewResult.status === 'rejected' ? `overview: ${overviewResult.reason instanceof Error ? overviewResult.reason.message : 'failed'}` : null,
      minersResult.status === 'rejected' ? `miners: ${minersResult.reason instanceof Error ? minersResult.reason.message : 'failed'}` : null,
      alertsResult.status === 'rejected' ? `alerts: ${alertsResult.reason instanceof Error ? alertsResult.reason.message : 'failed'}` : null,
    ].filter((value): value is string => Boolean(value));

    return NextResponse.json({
      overview,
      miners,
      alerts,
      errors,
    });
  } catch (error) {
    console.error('Compliance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}
