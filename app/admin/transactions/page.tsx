'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDate } from '../../../lib/date';

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
  miner_reg_number: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

interface Stats {
  total_transactions: number;
  total_value_usd: number;
  flagged_count: number;
  cdd_incomplete_count: number;
}

const ITEMS_PER_PAGE = 10;

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRef(id: number) {
  return `TXN-${String(id).padStart(4, '0')}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile: 'Mobile',
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    paymentMethod: 'all',
    flaggedOnly: false,
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError('');
      // Silently remove any transactions whose miner no longer exists before loading
      await fetch('http://localhost:8000/transactions', { method: 'DELETE' }).catch(() => {});

      const response = await fetch('/api/admin/transactions', {
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load transactions');
      }

      const data: {
        stats: Stats;
        transactions: Transaction[];
        errors?: string[];
      } = await response.json();

      setStats(data.stats);
      setTransactions(data.transactions);

      if (data.errors && data.errors.length > 0) {
        setLoadError(`Some transaction sections could not be loaded: ${data.errors.join(' | ')}`);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:8000/transactions/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setTransactions(prev => prev.filter(t => t.id !== deleteTarget.id));
      setStats(prev => prev ? {
        ...prev,
        total_transactions: prev.total_transactions - 1,
        total_value_usd: prev.total_value_usd - deleteTarget.sale_amount_usd,
        flagged_count: prev.flagged_count - (deleteTarget.is_flagged ? 1 : 0),
        cdd_incomplete_count: prev.cdd_incomplete_count - (!deleteTarget.cdd_completed ? 1 : 0),
      } : prev);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleFilter = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Client-side filtering
  const filtered = transactions.filter(t => {
    if (filters.paymentMethod !== 'all' && t.payment_method !== filters.paymentMethod) return false;
    if (filters.flaggedOnly && !t.is_flagged) return false;
    if (filters.dateFrom && t.transaction_date < filters.dateFrom) return false;
    if (filters.dateTo && t.transaction_date > filters.dateTo) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !t.buyer_name.toLowerCase().includes(q) &&
        !t.buying_centre.toLowerCase().includes(q) &&
        !(t.miner_reg_number ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // ── Stat card ─────────────────────────────────────────────────────────────
  const StatCard = ({
    label,
    value,
    sub,
    highlight,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    highlight?: boolean;
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${highlight ? 'text-gray-900' : 'text-gray-900'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="transactions" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">Transactions</div>
            <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {loading ? '…' : `${transactions.length} total`}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          {loadError && (
            <div className="px-5 pt-4">
              <div className="border-l-2 border-gray-400 bg-white rounded-r px-3 py-2">
                <div className="text-xs text-gray-600">{loadError}</div>
              </div>
            </div>
          )}

          {/* STATS ROW */}
          <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-2">
            <StatCard
              label="Total transactions"
              value={loading ? '…' : (stats?.total_transactions ?? 0)}
            />
            <StatCard
              label="Total volume"
              value={loading ? '…' : `$${fmtCurrency(stats?.total_value_usd ?? 0)}`}
              sub="USD"
            />
            <StatCard
              label="Flagged"
              value={loading ? '…' : (stats?.flagged_count ?? 0)}
              sub="require review"
            />
            <StatCard
              label="CDD incomplete"
              value={loading ? '…' : (stats?.cdd_incomplete_count ?? 0)}
              sub="due diligence gaps"
            />
          </div>

          {/* FILTER BAR */}
          <div className="bg-white border-y border-gray-100 px-5 py-3 flex items-center gap-2 flex-wrap mx-5 mt-2 rounded-lg border">
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
            <select
              value={filters.paymentMethod}
              onChange={e => handleFilter('paymentMethod', e.target.value)}
              className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600"
            >
              <option value="all">All methods</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="mobile">Mobile money</option>
            </select>
            <button
              onClick={() => handleFilter('flaggedOnly', !filters.flaggedOnly)}
              className={`h-8 text-xs px-3 rounded border transition ${
                filters.flaggedOnly
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Flagged only
            </button>
            <input
              type="text"
              placeholder="Search buyer, centre or miner reg…"
              value={filters.search}
              onChange={e => handleFilter('search', e.target.value)}
              className="flex-1 h-8 border border-gray-200 rounded bg-white px-3 text-xs text-gray-600 focus:outline-none focus:border-gray-800"
            />
            {(filters.dateFrom || filters.dateTo || filters.paymentMethod !== 'all' || filters.flaggedOnly || filters.search) && (
              <button
                onClick={() => {
                  setFilters({ dateFrom: '', dateTo: '', paymentMethod: 'all', flaggedOnly: false, search: '' });
                  setCurrentPage(1);
                }}
                className="h-8 text-xs text-gray-400 hover:text-gray-600 px-2"
              >
                Clear
              </button>
            )}
          </div>

          {/* TABLE */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mx-5 mt-3">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">Ref</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Date</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Miner reg</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[14%]">Buyer / agent</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[13%]">Buying centre</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">Weight</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Amount</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">Payment</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">CDD</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Flag</th>
                  <th className="w-[5%]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 11 }).map((__, j) => (
                        <td key={j} className="py-2.5 px-3">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-xs text-gray-400">
                      {transactions.length === 0
                        ? 'No transactions recorded yet. They will appear here once miners submit gold sales.'
                        : 'No transactions match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  paginated.map(txn => {
                    const cddOk = txn.buyer_verified && txn.cdd_completed;
                    return (
                      <tr
                        key={txn.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${txn.is_flagged ? 'bg-gray-50' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-xs text-gray-500">{fmtRef(txn.id)}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-700">{fmtDate(txn.transaction_date)}</td>
                        <td className="py-2.5 px-3">
                          {txn.miner_reg_number ? (
                            <span className="text-xs text-gray-600">{txn.miner_reg_number}</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-700 truncate">{txn.buyer_name}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-700 truncate">{txn.buying_centre}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-700">
                          <div>{txn.gold_weight_grams}g</div>
                          <div className="text-gray-400">{(txn.gold_weight_grams / 1000).toFixed(3)} kg</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-700">${fmtCurrency(txn.sale_amount_usd)}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            {PAYMENT_LABELS[txn.payment_method] ?? txn.payment_method}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {cddOk ? (
                            <span className="text-xs text-gray-400">✓</span>
                          ) : (
                            <span className="text-xs text-gray-500">✗ Incomplete</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {txn.is_flagged ? (
                            <span
                              className="inline-flex text-xs px-2 py-0.5 rounded bg-gray-900 text-white"
                              title={txn.flag_reason ?? ''}
                            >
                              Flagged
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setDeleteTarget(txn)}
                            className="text-xs text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {!loading && filtered.length > 0 && (
            <div className="flex justify-between items-center px-5 py-3">
              <div className="text-xs text-gray-400">
                Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of{' '}
                {filtered.length} transactions
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (currentPage <= 4) p = i + 1;
                  else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
                  else p = currentPage - 3 + i;
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

          <div className="pb-4" />
        </div>
      </div>

      {/* Delete transaction confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-80 shadow-lg">
            <div className="text-sm font-medium text-gray-900 mb-1">Delete transaction</div>
            <div className="text-xs text-gray-500 mb-4 leading-relaxed">
              Permanently delete{' '}
              <span className="font-medium text-gray-700">{fmtRef(deleteTarget.id)}</span>{' '}
              ({fmtDate(deleteTarget.transaction_date)} · ${fmtCurrency(deleteTarget.sale_amount_usd)})?
              This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-gray-900 text-white text-sm py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
