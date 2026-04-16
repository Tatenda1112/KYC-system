import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization') || '';

    const [overviewRes, alertsRes, minersRes] = await Promise.all([
      fetch(`${BACKEND}/compliance/overview`, { headers: { Authorization: token } }),
      fetch(`${BACKEND}/compliance/alerts`,   { headers: { Authorization: token } }),
      fetch(`${BACKEND}/compliance/miners`,   { headers: { Authorization: token } }),
    ]);

    if (!overviewRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch overview' }, { status: overviewRes.status });
    }

    const overview  = await overviewRes.json();
    const alerts    = alertsRes.ok  ? await alertsRes.json()  : [];
    const miners    = minersRes.ok  ? await minersRes.json()  : [];

    // KYC counts from distribution
    const kyc = overview.kyc_distribution ?? {};
    const totalMiners    = overview.total_miners     ?? 0;
    const verifiedMiners = kyc['Verified']           ?? 0;
    const pendingKyc     = kyc['Pending']            ?? 0;
    const flaggedCount   = (kyc['Flagged'] ?? 0) + (kyc['Rejected'] ?? 0);

    // Compliance score by district — average score per district from live miners
    const districtMap: Record<string, { total: number; count: number }> = {};
    for (const m of miners) {
      const d = m.district ?? 'Unknown';
      if (!districtMap[d]) districtMap[d] = { total: 0, count: 0 };
      districtMap[d].total += m.score;
      districtMap[d].count += 1;
    }
    const complianceByDistrict = Object.entries(districtMap)
      .map(([district, { total, count }]) => ({
        district,
        score: Math.round(total / count),
      }))
      .sort((a, b) => b.score - a.score);

    // Registration type breakdown from live miners
    const typeMap: Record<string, number> = {};
    for (const m of miners) {
      const t = m.registration_type ?? 'Other';
      typeMap[t] = (typeMap[t] ?? 0) + 1;
    }
    const total = miners.length || 1;
    const registrationBreakdown = Object.entries(typeMap).map(([type, count]) => ({
      type,
      percentage: Math.round((count / total) * 100),
    }));

    // Recent flagged transactions — enrich with miner name/district
    const minerIndex: Record<string, { full_name: string; district: string }> = {};
    for (const m of miners) {
      minerIndex[m.reg_number] = { full_name: m.full_name, district: m.district };
    }
    const flaggedTransactions = alerts.slice(0, 10).map((a: {
      id: number;
      miner_reg_number: string | null;
      transaction_date: string;
      sale_amount_usd: number;
      flag_reason: string | null;
    }) => {
      const info = a.miner_reg_number ? minerIndex[a.miner_reg_number] : null;
      return {
        miner:      info?.full_name  ?? a.miner_reg_number ?? '—',
        district:   info?.district   ?? '—',
        flagReason: a.flag_reason    ?? 'Flagged',
        date:       a.transaction_date,
        amount:     a.sale_amount_usd,
      };
    });

    return NextResponse.json({
      totalMiners,
      verifiedMiners,
      pendingKyc,
      flaggedCount,
      totalTransactions: overview.total_transactions ?? 0,
      averageScore: overview.average_score ?? 0,
      complianceByDistrict,
      flaggedTransactions,
      registrationBreakdown,
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
