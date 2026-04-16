'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDate } from '../../../lib/date';

interface MinerInfo {
  reg_number: string;
  full_name: string;
  district: string;
  registration_type: string;
  kyc_status: string;
  score: number;
  risk: string;
  created_at: string;
}

interface Summary {
  total_transactions: number;
  total_value_usd: number;
  flagged_count: number;
  cdd_completion_rate: number;
}

interface Transaction {
  id: number;
  transaction_date: string;
  gold_weight_grams: number;
  sale_amount_usd: number;
  buying_centre: string;
  buyer_name: string;
  payment_method: string;
  cdd_ok: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
}

interface ReportData {
  miner: MinerInfo;
  summary: Summary;
  transactions: Transaction[];
}

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile: 'Mobile',
};

const KYC_BADGE: Record<string, string> = {
  Verified: 'bg-gray-100 text-gray-600',
  Pending: 'bg-gray-200 text-gray-600',
  Flagged: 'bg-gray-900 text-white',
  Rejected: 'bg-gray-800 text-white',
};

const RISK_BADGE: Record<string, string> = {
  High: 'bg-gray-900 text-white',
  Medium: 'bg-gray-200 text-gray-700',
  Low: 'bg-gray-100 text-gray-500',
};

function ScoreBar({ score }: { score: number }) {
  const w = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gray-800 rounded-full transition-all" style={{ width: `${w}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-10">{score}/100</span>
    </div>
  );
}

export default function MinerReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [minerName, setMinerName] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const fetchReport = useCallback(async (reg: string) => {
    setLoading(true);
    try {
      setLoadError('');
      const res = await fetch(`/api/miner/reports?reg=${encodeURIComponent(reg)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load report');
      }

      const payload: { data: ReportData | null; error: string | null } = await res.json();
      setData(payload.data);
      if (payload.data?.miner?.kyc_status) {
        setMinerKycStatus(payload.data.miner.kyc_status);
        localStorage.setItem('minerKycStatus', payload.data.miner.kyc_status);
      }
      if (payload.error) {
        setLoadError(payload.error);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const reg = localStorage.getItem('minerRegNumber');
    const name = localStorage.getItem('minerName') ?? '';
    const status = localStorage.getItem('minerKycStatus') ?? '';
    setMinerRegNumber(reg);
    setMinerName(name);
    setMinerKycStatus(status);

    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
          if (user?.miner_reg_number) {
            setMinerRegNumber(user.miner_reg_number);
            localStorage.setItem('minerRegNumber', user.miner_reg_number);
          }
          if (user?.full_name) {
            setMinerName(user.full_name);
            localStorage.setItem('minerName', user.full_name);
          }
          if (user?.miner_kyc_status) {
            setMinerKycStatus(user.miner_kyc_status);
            localStorage.setItem('minerKycStatus', user.miner_kyc_status);
          } else {
            setMinerKycStatus('');
            localStorage.removeItem('minerKycStatus');
          }
        })
        .catch(() => {});
    }

    if (reg) {
      fetchReport(reg);
    } else {
      setLoading(false);
    }
  }, [fetchReport]);

  const handleDownload = async () => {
    if (!minerRegNumber) return;
    setDownloading(true);
    try {
      const url = `/api/miner/reports/export?reg=${encodeURIComponent(minerRegNumber)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+?)"/);
      const fname = match ? match[1] : 'my_transactions.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ── No KYC ───────────────────────────────────────────────────────────────
  if (!loading && !minerRegNumber) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="downloadreport" userName={minerName || undefined} kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">Download report</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-xs">
              <div className="text-sm text-gray-700 font-medium mb-2">No KYC registration found</div>
              <div className="text-xs text-gray-400 leading-relaxed mb-5">
                Complete your KYC registration first. Your compliance report and transaction
                history will be available here once you have submitted at least one gold sale.
              </div>
              <button
                onClick={() => router.push('/miner/register')}
                className="bg-gray-900 text-white text-sm px-5 py-2 rounded-md hover:bg-gray-800 transition"
              >
                Start KYC registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && minerRegNumber && minerKycStatus && minerKycStatus !== 'Verified') {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="downloadreport" userName={minerName || undefined} kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">Download report</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="text-sm font-medium text-gray-800 mb-2">Reports locked</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Your KYC status is {minerKycStatus}. Reports and downloads become available after an administrator verifies your registration.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const txnsToShow = showAll
    ? (data?.transactions ?? [])
    : (data?.transactions ?? []).slice(0, 10);

  const tips = [
    {
      title: 'Complete CDD on every transaction',
      body: 'Always verify buyer identity and complete all due diligence steps. Each CDD-complete transaction raises your score.',
    },
    {
      title: 'Use bank or mobile money',
      body: 'Cash transactions above USD 500 are automatically flagged. Bank transfer or mobile money demonstrate formal banking compliance.',
    },
    {
      title: 'Maintain your KYC documents',
      body: 'Keeping your national ID, mining certificate and proof of address current with the compliance office prevents status downgrades.',
    },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="downloadreport" userName={minerName || undefined} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">Download report</div>
            {minerRegNumber && (
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {minerRegNumber}
              </div>
            )}
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || loading || !data}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-xs px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {downloading ? 'Generating…' : 'Download CSV'}
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-3xl mx-auto p-5 space-y-4">
            {loadError && (
              <div className="border-l-2 border-gray-400 bg-white pl-3 py-2.5 rounded-r shadow-sm">
                <div className="text-xs text-gray-600">{loadError}</div>
              </div>
            )}

            {/* COMPLIANCE SCORE CARD */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                Compliance score
              </div>
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
                  <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ) : data ? (
                <div>
                  <ScoreBar score={data.miner.score} />
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${KYC_BADGE[data.miner.kyc_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      KYC: {data.miner.kyc_status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${RISK_BADGE[data.miner.risk] ?? 'bg-gray-100 text-gray-600'}`}>
                      {data.miner.risk} risk
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">{data.miner.district} · {data.miner.registration_type}</div>
                </div>
              ) : null}
            </div>

            {/* ACTIVITY SUMMARY */}
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  label: 'Transactions',
                  value: loading ? '…' : (data?.summary.total_transactions ?? 0),
                  sub: 'recorded',
                },
                {
                  label: 'Total value',
                  value: loading ? '…' : `$${fmtCurrency(data?.summary.total_value_usd ?? 0)}`,
                  sub: 'USD',
                },
                {
                  label: 'CDD rate',
                  value: loading ? '…' : `${data?.summary.cdd_completion_rate ?? 0}%`,
                  sub: 'complete',
                },
                {
                  label: 'Flagged',
                  value: loading ? '…' : (data?.summary.flagged_count ?? 0),
                  sub: data?.summary.flagged_count === 0 ? 'none — good' : 'require review',
                },
              ].map(card => (
                <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                  <div className="text-xl font-medium text-gray-900">{card.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* TRANSACTION TABLE */}
            <div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2 px-1">
                Transaction history
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Ref</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[11%]">Date</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[19%]">Buyer / agent</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Weight</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[13%]">Amount (USD)</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Payment</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">CDD</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {Array.from({ length: 8 }).map((__, j) => (
                            <td key={j} className="py-2.5 px-3">
                              <div className="h-3 bg-gray-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : txnsToShow.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-xs text-gray-400">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      txnsToShow.map(txn => (
                        <tr
                          key={txn.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${txn.is_flagged ? 'bg-gray-50' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-xs text-gray-500">
                            TXN-{String(txn.id).padStart(4, '0')}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">{fmtDate(txn.transaction_date)}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-700 truncate">{txn.buyer_name}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">
                            <div>{txn.gold_weight_grams}g</div>
                            <div className="text-gray-400">{(txn.gold_weight_grams / 1000).toFixed(3)} kg</div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">${fmtCurrency(txn.sale_amount_usd)}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {PAYMENT_LABELS[txn.payment_method] ?? txn.payment_method}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            {txn.cdd_ok ? (
                              <span className="text-gray-400">✓</span>
                            ) : (
                              <span className="text-gray-500">✗</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {txn.is_flagged ? (
                              <span
                                className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded"
                                title={txn.flag_reason ?? ''}
                              >
                                Flagged
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">Clear</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && (data?.transactions.length ?? 0) > 10 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600 px-1"
                >
                  {showAll
                    ? 'Show less'
                    : `Show all ${data?.transactions.length} transactions`}
                </button>
              )}
            </div>

            {/* TIPS */}
            <div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2 px-1">
                Improve your score
              </div>
              <div className="space-y-2">
                {tips.map(tip => (
                  <div key={tip.title} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-gray-700 mb-1">{tip.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{tip.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pb-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
