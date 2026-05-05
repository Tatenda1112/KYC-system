'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDate } from '../../../lib/date';

interface ComplianceData {
  reg_number: string;
  full_name: string;
  district: string;
  kyc_status: string;
  score: number;
  risk: string;
  total_transactions: number;
  flagged_transactions: number;
  cdd_completion_rate: number;
  cash_transaction_count: number;
  recent_flags: {
    id: number;
    transaction_date: string;
    sale_amount_usd: number;
    flag_reason: string | null;
  }[];
}

interface Transaction {
  id: number;
  transaction_date: string;
  gold_weight_grams: number;
  sale_amount_usd: number;
  buying_centre: string;
  buyer_name: string;
  payment_method: string;
  buyer_verified: boolean;
  cdd_completed: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRef(id: number) {
  return `TXN-${String(id).padStart(4, '0')}`;
}

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

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile: 'Mobile',
};

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke="#111827"
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-medium text-gray-900 leading-none">{score}</div>
        <div className="text-xs text-gray-400">/100</div>
      </div>
    </div>
  );
}

// Inner component that uses useSearchParams
function DashboardContent() {
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [minerName, setMinerName] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionSuccess = searchParams?.get('transaction') === 'success';

  const fetchData = useCallback(async (reg: string) => {
    setLoading(true);
    try {
      setLoadError('');
      const response = await fetch(`/api/miner/dashboard?reg=${encodeURIComponent(reg)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load dashboard data');
      }

      const data: {
        compliance: ComplianceData | null;
        transactions: Transaction[];
        errors?: string[];
      } = await response.json();

      setCompliance(data.compliance);
      setTransactions(data.transactions);
      if (data.compliance?.kyc_status) {
        setMinerKycStatus(data.compliance.kyc_status);
        localStorage.setItem('minerKycStatus', data.compliance.kyc_status);
      }

      if (data.errors && data.errors.length > 0) {
        setLoadError(`Some dashboard sections could not be loaded: ${data.errors.join(' | ')}`);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard data');
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

    // Always refresh KYC status from the backend so stale localStorage doesn't block access
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

    if (reg && status === 'Verified') fetchData(reg);
    else setLoading(false);
  }, [fetchData]);

  useEffect(() => {
    if (transactionSuccess) {
      setToastVisible(true);
      const t = setTimeout(() => setToastVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [transactionSuccess]);

  // Poll /auth/me every 15 s while awaiting approval — this is the most reliable
  // source of truth since it reads the user's linked MinerRegistration directly.
  useEffect(() => {
    if (minerKycStatus === 'Verified' || loading) return;
    if (!minerRegNumber) return;

    const checkApproval = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const user = await res.json();
        const status: string | null = user.miner_kyc_status ?? null;
        if (status && status !== minerKycStatus) {
          setMinerKycStatus(status);
          localStorage.setItem('minerKycStatus', status);
          if (status === 'Verified' && minerRegNumber) {
            fetchData(minerRegNumber);
          }
        }
      } catch {}
    };

    checkApproval();
    const interval = setInterval(checkApproval, 15_000);
    return () => clearInterval(interval);
  }, [minerRegNumber, minerKycStatus, loading, fetchData]);

  const recent5 = transactions.slice(0, 5);
  const totalValue = transactions.reduce((s, t) => s + t.sale_amount_usd, 0);

  if (!loading && minerRegNumber && minerKycStatus && minerKycStatus !== 'Verified') {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mydashboard" userName={minerName || undefined} kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">My dashboard</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="max-w-md bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-sm font-medium text-gray-800 mb-2">Profile locked pending admin approval</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Your miner profile status is <span className="font-medium">{minerKycStatus}</span>. Only approved miners can use customer, transaction, STR and reporting features.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Unregistered state ───────────────────────────────────────────────────
  if (!loading && !minerRegNumber) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mydashboard" kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">My dashboard</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gray-400">
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-gray-800 mb-2">Welcome to the miner portal</div>
              <div className="text-xs text-gray-400 leading-relaxed mb-6">
                Complete your KYC registration to start recording gold sales and accessing
                your compliance dashboard. The process takes about 5 minutes.
              </div>
              <button
                onClick={() => router.push('/miner/register')}
                className="bg-gray-900 text-white text-sm px-6 py-2.5 rounded-md hover:bg-gray-800 transition"
              >
                Start KYC registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="mydashboard" userName={minerName || undefined} kycStatus={minerKycStatus || undefined} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">My dashboard</div>
            {minerRegNumber && (
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {minerRegNumber}
              </div>
            )}
          </div>
          <button
            onClick={() => router.push('/miner/transactions/new')}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            + Record new sale
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          {loadError && (
            <div className="mx-5 mt-4 border-l-2 border-gray-400 bg-white pl-3 py-2.5 rounded-r shadow-sm">
              <div className="text-xs text-gray-600">{loadError}</div>
            </div>
          )}

          {/* SUCCESS TOAST */}
          {toastVisible && (
            <div className="mx-5 mt-4 border-l-2 border-gray-500 bg-white pl-3 py-2.5 rounded-r shadow-sm">
              <div className="text-xs font-medium text-gray-700">Transaction recorded</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Your gold sale has been saved and is under compliance review.
              </div>
            </div>
          )}

          {/* STAT ROW */}
          <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-0">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total transactions</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (compliance?.total_transactions ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">recorded</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total value</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : `$${fmtCurrency(totalValue)}`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">USD</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">CDD completion</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : `${compliance?.cdd_completion_rate ?? 0}%`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">of transactions</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Flagged</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (compliance?.flagged_transactions ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {(compliance?.flagged_transactions ?? 0) > 0 ? 'require review' : 'none — clear'}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="grid grid-cols-[1fr_280px] gap-4 px-5 pt-4 pb-5">

            {/* LEFT — Recent transactions */}
            <div className="space-y-4">

              {/* Flagged alert */}
              {!loading && (compliance?.flagged_transactions ?? 0) > 0 && (
                <div className="border-l-2 border-gray-400 bg-gray-50 pl-3 py-2.5 rounded-r">
                  <div className="text-xs font-medium text-gray-600 mb-0.5">
                    {compliance!.flagged_transactions} flagged transaction
                    {compliance!.flagged_transactions > 1 ? 's' : ''} require attention
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    These transactions are under compliance review and may affect your score.
                    {' '}
                    <button
                      onClick={() => router.push('/miner/transactions')}
                      className="underline hover:text-gray-700"
                    >
                      View details
                    </button>
                  </div>
                </div>
              )}

              {/* Recent transactions card */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Recent transactions
                  </div>
                  <button
                    onClick={() => router.push('/miner/transactions')}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    View all →
                  </button>
                </div>
                <table className="w-full table-fixed border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[10%]">Ref</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[12%]">Date</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[25%]">Buyer / agent</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[10%]">Weight</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[15%]">Amount</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[10%]">Pay</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2 px-3 text-left w-[9%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {Array.from({ length: 7 }).map((__, j) => (
                            <td key={j} className="py-2.5 px-3">
                              <div className="h-3 bg-gray-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : recent5.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center">
                          <div className="text-xs text-gray-400 mb-3">No transactions yet.</div>
                          <button
                            onClick={() => router.push('/miner/transactions/new')}
                            className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded hover:bg-gray-50"
                          >
                            Record your first sale
                          </button>
                        </td>
                      </tr>
                    ) : (
                      recent5.map(txn => (
                        <tr
                          key={txn.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${txn.is_flagged ? 'bg-gray-50' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-xs text-gray-500">{fmtRef(txn.id)}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">{fmtDate(txn.transaction_date)}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-700 truncate">{txn.buyer_name}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">
                            <div>{txn.gold_weight_grams}g</div>
                            <div className="text-gray-400">{(txn.gold_weight_grams / 1000).toFixed(3)} kg</div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-700">${fmtCurrency(txn.sale_amount_usd)}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {PAYMENT_LABELS[txn.payment_method] ?? txn.payment_method}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {txn.is_flagged ? (
                              <span className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded" title={txn.flag_reason ?? ''}>
                                Flag
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
            </div>

            {/* RIGHT — Identity + Score + Actions */}
            <div className="space-y-3">

              {/* Identity card */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">
                  My profile
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : compliance ? (
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-xs text-gray-400">Name</div>
                      <div className="text-xs text-gray-800 font-medium mt-0.5">{compliance.full_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Reg number</div>
                      <div className="text-xs text-gray-800 font-mono mt-0.5">{compliance.reg_number}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">District</div>
                      <div className="text-xs text-gray-800 mt-0.5">{compliance.district}</div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${KYC_BADGE[compliance.kyc_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        KYC: {compliance.kyc_status}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${RISK_BADGE[compliance.risk] ?? 'bg-gray-100 text-gray-600'}`}>
                        {compliance.risk} risk
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Compliance score */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">
                  Compliance score
                </div>
                {loading ? (
                  <div className="h-20 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <div className="flex items-center gap-4">
                    <ScoreRing score={compliance?.score ?? 0} />
                    <div>
                      <div className="text-xs text-gray-500 leading-relaxed">
                        {(compliance?.score ?? 0) >= 76
                          ? 'Low risk — good standing'
                          : (compliance?.score ?? 0) >= 60
                          ? 'Medium risk — needs improvement'
                          : 'High risk — action required'}
                      </div>
                      <button
                        onClick={() => router.push('/miner/reports')}
                        className="text-xs text-gray-400 underline hover:text-gray-600 mt-1.5 block"
                      >
                        View full report
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">
                  Quick actions
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/miner/transactions/new')}
                    className="w-full bg-gray-900 text-white text-xs py-2 rounded-md hover:bg-gray-800 transition"
                  >
                    Record gold sale
                  </button>
                  <button
                    onClick={() => router.push('/miner/transactions')}
                    className="w-full bg-white border border-gray-200 text-gray-600 text-xs py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    My transactions
                  </button>
                  <button
                    onClick={() => router.push('/miner/reports')}
                    className="w-full bg-white border border-gray-200 text-gray-600 text-xs py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    Download report
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js App Router
export default function MinerDashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
