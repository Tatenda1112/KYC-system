'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDatetime } from '../../../lib/date';

const BACKEND = 'http://localhost:8000';

interface AuditEntry {
  id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_ref: string;
  actor: string;
  detail: string;
}

interface AuditResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditEntry[];
}

interface Stats {
  miner_registered?: number;
  kyc_status_updated?: number;
  transaction_created?: number;
  transaction_flagged?: number;
}

// ── Action display config ─────────────────────────────────────────────────────
const ACTION_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  miner_registered: {
    label: 'Miner registered',
    badge: 'bg-gray-100 text-gray-600',
    dot: 'bg-gray-400',
  },
  kyc_status_updated: {
    label: 'KYC updated',
    badge: 'bg-gray-200 text-gray-700',
    dot: 'bg-gray-600',
  },
  transaction_created: {
    label: 'Transaction',
    badge: 'bg-gray-50 text-gray-500',
    dot: 'bg-gray-300',
  },
  transaction_flagged: {
    label: 'Flagged',
    badge: 'bg-gray-900 text-white',
    dot: 'bg-gray-900',
  },
};

const fmtDate = fmtDatetime;

// Group entries by calendar date
function groupByDate(items: AuditEntry[]): Record<string, AuditEntry[]> {
  const groups: Record<string, AuditEntry[]> = {};
  for (const item of items) {
    const key = item.created_at.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    action: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const router = useRouter();

  const fetchData = useCallback(
    async (p: number, f: typeof filters) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p) });
        if (f.action !== 'all') params.set('action', f.action);
        if (f.dateFrom) params.set('date_from', f.dateFrom);
        if (f.dateTo) params.set('date_to', f.dateTo);
        if (f.search) params.set('search', f.search);

        const [logRes, statsRes] = await Promise.all([
          fetch(`${BACKEND}/audit/logs?${params}`),
          fetch(`${BACKEND}/audit/stats`),
        ]);
        if (logRes.ok) setData(await logRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (err) {
        console.error('Failed to load audit log:', err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(page, filters);
  }, [fetchData, page, filters]);

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: 'all', dateFrom: '', dateTo: '', search: '' });
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;
  const grouped = data ? groupByDate(data.items) : {};
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const hasActiveFilter =
    filters.action !== 'all' || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="auditlog" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">Audit log</div>
            <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {loading ? '…' : `${data?.total ?? 0} events`}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">

          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-2">
            {[
              { label: 'Miners registered', key: 'miner_registered' as const },
              { label: 'KYC updates', key: 'kyc_status_updated' as const },
              { label: 'Transactions logged', key: 'transaction_created' as const },
              { label: 'Auto-flags raised', key: 'transaction_flagged' as const },
            ].map(card => (
              <div key={card.key} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-2xl font-medium text-gray-900">
                  {loading ? '…' : (stats[card.key] ?? 0)}
                </div>
              </div>
            ))}
          </div>

          {/* FILTER BAR */}
          <div className="bg-white border border-gray-200 rounded-lg mx-5 mt-2 px-4 py-3 flex items-center gap-2 flex-wrap">
            <select
              value={filters.action}
              onChange={e => handleFilter('action', e.target.value)}
              className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600"
            >
              <option value="all">All events</option>
              <option value="miner_registered">Miner registered</option>
              <option value="kyc_status_updated">KYC updated</option>
              <option value="transaction_created">Transaction created</option>
              <option value="transaction_flagged">Transaction flagged</option>
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">From</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => handleFilter('dateFrom', e.target.value)}
                className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600 focus:outline-none focus:border-gray-800"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">To</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => handleFilter('dateTo', e.target.value)}
                className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600 focus:outline-none focus:border-gray-800"
              />
            </div>
            <input
              type="text"
              placeholder="Search ref, actor or detail…"
              value={filters.search}
              onChange={e => handleFilter('search', e.target.value)}
              className="flex-1 h-8 border border-gray-200 rounded bg-white px-3 text-xs text-gray-600 focus:outline-none focus:border-gray-800"
            />
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="h-8 text-xs text-gray-400 hover:text-gray-600 px-2"
              >
                Clear
              </button>
            )}
          </div>

          {/* LOG FEED */}
          <div className="px-5 mt-3 pb-4">
            {loading ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-gray-100 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/3" />
                    </div>
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
                  </div>
                ))}
              </div>
            ) : data?.items.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg py-14 text-center">
                <div className="text-xs text-gray-400">
                  {hasActiveFilter ? 'No events match the current filters.' : 'No audit events recorded yet.'}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {dateKeys.map(dateKey => (
                  <div key={dateKey}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-xs font-medium text-gray-400">
                        {fmtDate(dateKey + 'T12:00:00')}
                      </div>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      {grouped[dateKey].map((entry, idx) => {
                        const cfg = ACTION_CONFIG[entry.action] ?? {
                          label: entry.action,
                          badge: 'bg-gray-100 text-gray-600',
                          dot: 'bg-gray-300',
                        };
                        const isLast = idx === grouped[dateKey].length - 1;
                        const isMiner = entry.entity_type === 'miner';
                        return (
                          <div
                            key={entry.id}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition ${!isLast ? 'border-b border-gray-100' : ''}`}
                          >
                            {/* Event dot */}
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />

                            {/* Main content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className={`inline-flex text-xs px-2 py-0.5 rounded ${cfg.badge}`}>
                                  {cfg.label}
                                </span>
                                <span
                                  className="text-xs text-gray-600 font-medium cursor-pointer hover:text-gray-900"
                                  onClick={() => {
                                    if (isMiner) {
                                      // Find numeric id by searching miners — for now just navigate to miners list
                                      router.push('/admin/miners');
                                    } else {
                                      router.push('/admin/transactions');
                                    }
                                  }}
                                >
                                  {entry.entity_ref}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 leading-relaxed">
                                {entry.detail}
                              </div>
                              <div className="text-xs text-gray-300 mt-0.5">
                                actor: {entry.actor}
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="text-xs text-gray-300 flex-shrink-0 pt-0.5">
                              {new Date(entry.created_at).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PAGINATION */}
            {!loading && totalPages > 1 && (
              <div className="flex justify-between items-center py-3">
                <div className="text-xs text-gray-400">
                  Page {page} of {totalPages} · {data?.total} total events
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-7 px-3 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p = i + 1;
                    if (totalPages > 7) {
                      if (page <= 4) p = i + 1;
                      else if (page >= totalPages - 3) p = totalPages - 6 + i;
                      else p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs rounded flex items-center justify-center ${
                          p === page
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-7 px-3 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
