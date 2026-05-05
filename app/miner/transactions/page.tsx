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

export default function MinerTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [minerName, setMinerName] = useState<string>('');
  const [minerKycStatus, setMinerKycStatus] = useState('');

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    paymentMethod: 'all',
    flaggedOnly: false,
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const fetchTransactions = useCallback(async (regNumber: string) => {
    setLoading(true);
    try {
      setLoadError('');
      const res = await fetch(`/api/miner/transactions?reg=${encodeURIComponent(regNumber)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load transactions');
      }

      const data: { transactions?: Transaction[]; error: string | null } = await res.json();
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      if (data.error) {
        setLoadError(data.error);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load transactions');
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
      fetchTransactions(reg);
    } else {
      setLoading(false);
    }
  }, [fetchTransactions]);

  const handleFilter = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filtered = transactions.filter(t => {
    if (filters.paymentMethod !== 'all' && t.payment_method !== filters.paymentMethod)
      return false;
    if (filters.flaggedOnly && !t.is_flagged) return false;
    if (filters.dateFrom && t.transaction_date < filters.dateFrom) return false;
    if (filters.dateTo && t.transaction_date > filters.dateTo) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !t.buyer_name.toLowerCase().includes(q) &&
        !t.buying_centre.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Summary stats derived from own transactions
  const totalValue = transactions.reduce((s, t) => s + t.sale_amount_usd, 0);
  const flaggedCount = transactions.filter(t => t.is_flagged).length;

  // ── No KYC yet ─────────────────────────────────────────────────────────────
  if (!loading && !minerRegNumber) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mytransactions" userName={minerName || undefined} kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">My transactions</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-xs">
              <div className="text-sm text-gray-700 font-medium mb-2">No KYC registration found</div>
              <div className="text-xs text-gray-400 leading-relaxed mb-5">
                Complete your KYC registration first. Once approved, your transaction history
                will appear here.
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

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="mytransactions" userName={minerName || undefined} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-800">My transactions</div>
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

          {/* STATS ROW */}
          <div className="grid grid-cols-3 gap-3 px-5 pt-4 pb-2">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total recorded</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : transactions.length}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">transactions</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total value</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : `$${fmtCurrency(totalValue)}`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">USD</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Flagged</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : flaggedCount}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {flaggedCount > 0 ? 'require attention' : 'none — good standing'}
              </div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white border border-gray-200 rounded-lg mx-5 mt-2 px-4 py-3 flex items-center gap-2 flex-wrap">
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
              placeholder="Search buyer or centre…"
              value={filters.search}
              onChange={e => handleFilter('search', e.target.value)}
              className="flex-1 h-8 border border-gray-200 rounded bg-white px-3 text-xs text-gray-600 focus:outline-none focus:border-gray-800"
            />
          </div>

          {/* TABLE */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mx-5 mt-3">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Ref</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[10%]">Date</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[18%]">Buyer / agent</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[16%]">Buying centre</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Weight</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Amount (USD)</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">Payment</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[9%]">CDD</th>
                  <th className="text-xs text-gray-400 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[8%]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="py-2.5 px-3">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      {transactions.length === 0 ? (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">No transactions recorded yet.</div>
                          <button
                            onClick={() => router.push('/miner/transactions/new')}
                            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50"
                          >
                            Record your first sale
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">No transactions match the filters.</div>
                      )}
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
                            <span className="text-xs text-gray-300">Clear</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {!loading && filtered.length > ITEMS_PER_PAGE && (
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

          {/* Flagged notice */}
          {!loading && flaggedCount > 0 && (
            <div className="mx-5 mt-2 mb-4 border-l-2 border-gray-400 bg-gray-50 pl-3 py-2.5 rounded-r">
              <div className="text-xs font-medium text-gray-600 mb-0.5">
                {flaggedCount} flagged transaction{flaggedCount > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Flagged transactions are under compliance review. This may affect your score.
                Contact your compliance officer for more information.
              </div>
            </div>
          )}

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}
