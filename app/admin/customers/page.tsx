'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';

const ITEMS_PER_PAGE = 10;

interface CustomerRow {
  id: number;
  full_name: string;
  national_id: string;
  miner_reg_number: string | null;
  miner_full_name: string | null;
  miner_district: string | null;
  risk_level: string;
  is_flagged: boolean;
  politically_exposed: boolean;
  total_transactions: number;
  total_value_usd: number;
  last_transaction: string | null;
  created_at: string;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RISK_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border border-red-300',
  medium: 'bg-amber-100 text-amber-800 border border-amber-300',
  low: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
};

export default function AdminCustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [pepOnly, setPepOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/customers', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load customers');
      const data: { customers?: CustomerRow[]; error: string | null } = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      if (data.error) setLoadError(data.error);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    if (riskFilter !== 'all' && c.risk_level !== riskFilter) return false;
    if (flaggedOnly && !c.is_flagged) return false;
    if (pepOnly && !c.politically_exposed) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.full_name.toLowerCase().includes(q) &&
        !c.national_id.toLowerCase().includes(q) &&
        !(c.miner_full_name ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Stats
  const now = new Date();
  const newThisMonth = customers.filter(c => {
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const flaggedCount = customers.filter(c => c.is_flagged).length;
  const pepCount = customers.filter(c => c.politically_exposed).length;

  const deleteCustomer = async (customer: CustomerRow) => {
    const confirmedName = window.prompt(
      `Type the full customer name to confirm deletion:\n\n${customer.full_name}`,
      '',
    );
    if (confirmedName !== customer.full_name) {
      if (confirmedName !== null) {
        setLoadError('Name confirmation did not match. Customer was not deleted.');
      }
      return;
    }
    setDeleteLoadingId(customer.id);
    setLoadError('');
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to delete customer');
      }
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to delete customer');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="customers" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">Customer overview</div>
            <div className="text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
              {loading ? '…' : `${customers.length} total`}
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
          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total customers</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : customers.length}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">across all miners</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Flagged customers</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : flaggedCount}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">require review</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">PEP customers</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : pepCount}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">enhanced due diligence</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">New this month</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : newThisMonth}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">recently registered</div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white border border-gray-200 rounded-lg mx-5 mb-3 px-4 py-3 flex items-center gap-2 flex-wrap">
            <select
              value={riskFilter}
              onChange={e => { setRiskFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-600"
            >
              <option value="all">All risk levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="button"
              onClick={() => { setFlaggedOnly(v => !v); setCurrentPage(1); }}
              className={`h-8 text-xs px-3 rounded border transition ${
                flaggedOnly
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Flagged only
            </button>
            <button
              type="button"
              onClick={() => { setPepOnly(v => !v); setCurrentPage(1); }}
              className={`h-8 text-xs px-3 rounded border transition ${
                pepOnly
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              PEP only
            </button>
            <input
              type="text"
              placeholder="Search by name, ID or miner..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="flex-1 h-8 border border-gray-200 rounded bg-white px-3 text-xs text-gray-600 focus:outline-none focus:border-gray-800"
            />
          </div>

          {/* TABLE */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mx-5">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[18%]">Customer name</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[13%]">National ID</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[16%]">Linked miner</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[10%]">District</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[9%]">Risk</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[8%]">Trans.</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[12%]">Total value</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[12%]">Flag / PEP</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[8%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
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
                    <td colSpan={9} className="py-10 text-center text-xs text-gray-400">
                      {customers.length === 0
                        ? 'No customers registered yet.'
                        : 'No customers match the filters.'}
                    </td>
                  </tr>
                ) : (
                  paginated.map(c => (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${c.is_flagged ? 'bg-gray-50' : ''}`}
                      onClick={() => router.push(`/admin/customers/${c.id}`)}
                    >
                      <td className="py-2.5 px-3 text-xs text-gray-800 font-medium truncate">
                        {c.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{c.national_id}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-700 truncate">
                        {c.miner_full_name ?? c.miner_reg_number ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {c.miner_district ?? '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded capitalize ${RISK_BADGE[c.risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.risk_level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">{c.total_transactions}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">
                        ${fmtCurrency(c.total_value_usd)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          {c.is_flagged && (
                            <span className="bg-red-100 text-red-800 border border-red-300 text-xs px-2 py-0.5 rounded">
                              Flagged
                            </span>
                          )}
                          {c.politically_exposed && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2 py-0.5 rounded">
                              PEP
                            </span>
                          )}
                          {!c.is_flagged && !c.politically_exposed && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteCustomer(c); }}
                          disabled={deleteLoadingId === c.id}
                          className="text-xs px-2.5 py-1 rounded border border-red-300 bg-red-100 text-red-800 hover:bg-red-200 transition disabled:opacity-60"
                        >
                          {deleteLoadingId === c.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {!loading && filtered.length > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center px-5 py-3">
              <div className="text-xs text-gray-400">
                Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of{' '}
                {filtered.length}
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

          {/* AML note */}
          {!loading && customers.length > 0 && (
            <div className="mx-5 mt-2 mb-4 border-l-2 border-gray-300 bg-white pl-3 py-2.5 rounded-r">
              <div className="text-xs font-medium text-gray-600 mb-0.5">AML pattern detection</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Customers appearing across multiple miners may indicate money laundering patterns.
                Cross-reference national IDs against flagged customers from other districts.
              </div>
            </div>
          )}

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}
