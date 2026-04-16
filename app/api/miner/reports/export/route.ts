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
      `${BACKEND}/reports/export/transactions?miner_reg_number=${encodeURIComponent(reg)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Export failed: ${response.status}${text ? `: ${text}` : ''}` },
        { status: 500 }
      );
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'text/csv',
        'Content-Disposition':
          response.headers.get('Content-Disposition') ?? 'attachment; filename="my_transactions.csv"',
      },
    });
  } catch (error) {
    console.error('Miner report export API error:', error);
    return NextResponse.json(
      { error: 'Failed to export miner report' },
      { status: 500 }
    );
  }
}
