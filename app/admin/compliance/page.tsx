'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDate } from '../../../lib/date';

const ITEMS_PER_PAGE = 10;

interface Overview {
  total_miners: number;
  average_score: number;
  kyc_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  total_transactions: number;
  flagged_transactions: number;
}

interface MinerRow {
  id: number;
  reg_number: string;
  full_name: string;
  district: string;
  kyc_status: string;
  score: number;
  risk: string;
  flagged_transactions: number;
  total_transactions: number;
}

interface Alert {
  id: number;
  transaction_date: string;
  miner_reg_number: string | null;
  buyer_name: string;
  sale_amount_usd: number;
  payment_method: string;
  flag_reason: string | null;
  created_at: string;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ScoreBar({ score }: { score: number }) {
  const w = Math.max(0, Math.min(100, score));
  const color = score >= 76 ? 'bg-gray-700' : score >= 60 ? 'bg-gray-500' : 'bg-gray-900';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-7 text-right">{score}</span>
    </div>
  );
}

const RISK_BADGE: Record<string, string> = {
  High: 'bg-gray-900 text-white',
  Medium: 'bg-gray-200 text-gray-700',
  Low: 'bg-gray-100 text-gray-500',
};

const KYC_BADGE: Record<string, string> = {
  Verified: 'bg-gray-100 text-gray-600',
  Pending: 'bg-gray-200 text-gray-600',
  Flagged: 'bg-gray-900 text-white',
  Rejected: 'bg-gray-800 text-white',
};

export default function AdminCompliancePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [miners, setMiners] = useState<MinerRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'overview' | 'miners' | 'alerts'>('overview');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError('');
      const response = await fetch('/api/admin/compliance', {
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load compliance data');
      }

      const data: {
        overview: Overview;
        miners: MinerRow[];
        alerts: Alert[];
        errors?: string[];
      } = await response.json();

      setOverview(data.overview);
      setMiners(data.miners);
      setAlerts(data.alerts);

      if (data.errors && data.errors.length > 0) {
        setLoadError(`Some compliance sections could not be loaded: ${data.errors.join(' | ')}`);
      }
    } catch (err) {
      console.error('Failed to load compliance data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredMiners = miners.filter(m => {
    if (riskFilter !== 'all' && m.risk !== riskFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.full_name.toLowerCase().includes(q) && !m.reg_number.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredMiners.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filteredMiners.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const kyc = overview?.kyc_distribution ?? {};
  const risk = overview?.risk_distribution ?? {};

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="compliance" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">Compliance</div>
            <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {loading ? '…' : `${overview?.total_miners ?? 0} miners`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin/compliance/customers')}
            className="text-xs border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            View all customers
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          {loadError && (
            <div className="px-5 pt-4">
              <div className="border-l-2 border-gray-400 bg-white rounded-r px-3 py-2">
                <div className="text-xs text-gray-600">{loadError}</div>
              </div>
            </div>
          )}

          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-2">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Avg compliance score</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : overview?.average_score ?? 0}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">out of 100</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">High risk miners</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (risk['High'] ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">require attention</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">KYC verified</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (kyc['Verified'] ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {loading || !overview ? '' : `of ${overview.total_miners} registered`}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Flagged transactions</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (overview?.flagged_transactions ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">pending review</div>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-1 px-5 mb-3">
            {(['overview', 'miners', 'alerts'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded capitalize transition ${
                  tab === t
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'alerts' ? `Alerts${alerts.length > 0 ? ` (${alerts.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="px-5 grid grid-cols-2 gap-4 pb-4">

              {/* KYC status distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  KYC status distribution
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(['Verified', 'Pending', 'Flagged', 'Rejected'] as const).map(status => {
                      const count = kyc[status] ?? 0;
                      const total = overview?.total_miners ?? 1;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={status}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-gray-600">{status}</span>
                            <span className="text-xs text-gray-400">{count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-800 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Risk distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  Risk distribution
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(['High', 'Medium', 'Low'] as const).map(level => {
                      const count = risk[level] ?? 0;
                      const total = overview?.total_miners ?? 1;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={level}>
                          <div className="flex justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${RISK_BADGE[level]}`}
                              >
                                {level}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-800 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Score bracket breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 col-span-2">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  Score brackets
                </div>
                {loading ? (
                  <div className="h-8 bg-gray-100 rounded animate-pulse" />
                ) : (() => {
                  const brackets = [
                    { label: '0–39 (Critical)', min: 0, max: 39 },
                    { label: '40–59 (High risk)', min: 40, max: 59 },
                    { label: '60–75 (Medium risk)', min: 60, max: 75 },
                    { label: '76–100 (Low risk)', min: 76, max: 100 },
                  ];
                  return (
                    <div className="grid grid-cols-4 gap-3">
                      {brackets.map(b => {
                        const count = miners.filter(m => m.score >= b.min && m.score <= b.max).length;
                        return (
                          <div key={b.label} className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1 leading-tight">{b.label}</div>
                            <div className="text-xl font-medium text-gray-900">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── MINERS TAB ───────────────────────────────────────────────── */}
          {tab === 'miners' && (
            <div className="px-5 pb-4">
              {/* Filter bar */}
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2 mb-3">
                <select
                  value={riskFilter}
                  onChange={e => { setRiskFilter(e.target.value); setCurrentPage(1); }}
                  className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600"
                >
                  <option value="all">All risk levels</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input
                  type="text"
                  placeholder="Search name or reg number…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="flex-1 h-8 border border-gray-200 rounded bg-white px-3 text-xs text-gray-600 focus:outline-none focus:border-gray-800"
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[13%]">Reg no.</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[22%]">Name</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">District</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[11%]">KYC</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[22%]">Score</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Risk</th>
                      <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[11%]">Flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {Array.from({ length: 7 }).map((__, j) => (
                            <td key={j} className="py-2.5 px-3">
                              <div className="h-3 bg-gray-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                          No miners match the filter.
                        </td>
                      </tr>
                    ) : (
                      paginated.map(m => (
                        <tr
                          key={m.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/admin/miners/${m.id}`)}
                        >
                          <td className="py-2.5 px-3 text-xs text-gray-500">{m.reg_number}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-800">{m.full_name}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-600">{m.district}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex text-xs px-2 py-0.5 rounded ${KYC_BADGE[m.kyc_status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {m.kyc_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <ScoreBar score={m.score} />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex text-xs px-2 py-0.5 rounded ${RISK_BADGE[m.risk] ?? 'bg-gray-100 text-gray-600'}`}>
                              {m.risk}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            {m.flagged_transactions > 0 ? (
                              <span className="text-gray-700">{m.flagged_transactions} / {m.total_transactions}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && filteredMiners.length > ITEMS_PER_PAGE && (
                <div className="flex justify-between items-center py-3">
                  <div className="text-xs text-gray-400">
                    Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredMiners.length)} of{' '}
                    {filteredMiners.length}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let p = i + 1;
                      if (totalPages > 7) {
                        if (currentPage <= 4) p = i + 1;
                        else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
                        else p = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 text-xs rounded flex items-center justify-center ${
                            p === currentPage
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ALERTS TAB ───────────────────────────────────────────────── */}
          {tab === 'alerts' && (
            <div className="px-5 pb-4">
              {alerts.length === 0 && !loading ? (
                <div className="bg-white border border-gray-200 rounded-lg py-12 text-center">
                  <div className="text-xs text-gray-400">No flagged transactions — all clear.</div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full table-fixed border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Ref</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Date</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[13%]">Miner reg</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[14%]">Buyer</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[11%]">Amount</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Method</th>
                        <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[35%]">Flag reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            {Array.from({ length: 7 }).map((__, j) => (
                              <td key={j} className="py-2.5 px-3">
                                <div className="h-3 bg-gray-100 rounded animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        alerts.map(a => (
                          <tr key={a.id} className="border-b border-gray-100 bg-gray-50 hover:bg-gray-100">
                            <td className="py-2.5 px-3 text-xs text-gray-500">
                              TXN-{String(a.id).padStart(4, '0')}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-gray-700">{fmtDate(a.transaction_date)}</td>
                            <td className="py-2.5 px-3 text-xs text-gray-600">{a.miner_reg_number ?? '—'}</td>
                            <td className="py-2.5 px-3 text-xs text-gray-700 truncate">{a.buyer_name}</td>
                            <td className="py-2.5 px-3 text-xs text-gray-700">${fmtCurrency(a.sale_amount_usd)}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
                                {a.payment_method}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-gray-500 truncate" title={a.flag_reason ?? ''}>
                              {a.flag_reason ?? '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
