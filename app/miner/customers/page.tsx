'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDate } from '../../../lib/date';

interface Customer {
  id: number;
  full_name: string;
  national_id: string;
  risk_level: string;
  is_flagged: boolean;
  politically_exposed: boolean;
  total_transactions: number;
  total_value_usd: number;
  last_transaction: string | null;
  created_at: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('');
}

const RISK_STYLE: Record<string, string> = {
  high: 'text-xs text-red-700 font-semibold',
  medium: 'text-xs text-amber-700 font-semibold',
  low: 'text-xs text-emerald-700 font-semibold',
};

export default function MinerCustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [minerName, setMinerName] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');

  const fetchCustomers = useCallback(async (reg: string) => {
    setLoading(true);
    try {
      setLoadError('');
      const res = await fetch(
        `/api/customers?miner_reg_number=${encodeURIComponent(reg)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('Failed to load customers');
      const data: { customers?: Customer[]; error: string | null } = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      if (data.error) setLoadError(data.error);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load customers');
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
        .then(r => (r.ok ? r.json() : null))
        .then(user => {
          if (user?.miner_reg_number) {
            setMinerRegNumber(user.miner_reg_number);
            localStorage.setItem('minerRegNumber', user.miner_reg_number);
            fetchCustomers(user.miner_reg_number);
          }
          if (user?.full_name) {
            setMinerName(user.full_name);
            localStorage.setItem('minerName', user.full_name);
          }
          if (user?.miner_kyc_status) {
            setMinerKycStatus(user.miner_kyc_status);
            localStorage.setItem('minerKycStatus', user.miner_kyc_status);
          }
        })
        .catch(() => {});
    }

    if (reg) {
      fetchCustomers(reg);
    } else {
      setLoading(false);
    }
  }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || c.national_id.toLowerCase().includes(q);
  });

  // Stats
  const now = new Date();
  const activeThisMonth = customers.filter(c => {
    if (!c.last_transaction) return false;
    const d = new Date(c.last_transaction);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const flaggedCount = customers.filter(c => c.is_flagged).length;
  const pepCount = customers.filter(c => c.politically_exposed).length;

  if (!loading && minerKycStatus && minerKycStatus !== 'Verified') {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mycustomers" userName={minerName || undefined} kycStatus={minerKycStatus} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-semibold text-slate-900">My customers</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="text-sm font-medium text-gray-800 mb-2">Customers locked</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Your KYC status is {minerKycStatus}. Customer management is available after an
                administrator verifies your registration.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="mycustomers" userName={minerName || undefined} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">My customers</div>
            {!loading && (
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {customers.length}
              </div>
            )}
          </div>
          <button
            onClick={() => router.push('/miner/customers/new')}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            + Add customer
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">

          {/* STAT STRIP */}
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex gap-6">
            {[
              { label: 'Total customers', value: loading ? '…' : customers.length },
              { label: 'Active this month', value: loading ? '…' : activeThisMonth },
              { label: 'Flagged', value: loading ? '…' : flaggedCount },
              { label: 'PEP customers', value: loading ? '…' : pepCount },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-xs text-gray-400">{stat.label}</div>
                <div className="text-sm font-medium text-gray-900 mt-0.5">{stat.value}</div>
              </div>
            ))}
          </div>

          {loadError && (
            <div className="mx-5 mt-4 border-l-2 border-gray-400 bg-white pl-3 py-2 rounded-r">
              <div className="text-xs text-gray-600">{loadError}</div>
            </div>
          )}

          {/* SEARCH */}
          <div className="px-5 pt-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or national ID..."
              className="w-full h-9 border border-gray-200 rounded-md bg-white px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
            />
          </div>

          {/* CUSTOMER LIST */}
          <div className="mt-3 px-5 space-y-2 pb-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-32" />
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-48" />
                    </div>
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg py-12 text-center">
                {customers.length === 0 ? (
                  <div>
                    <div className="text-xs text-gray-500 mb-3">No customers recorded yet.</div>
                    <button
                      onClick={() => router.push('/miner/customers/new')}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50"
                    >
                      Add your first customer
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">No customers match your search.</div>
                )}
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => router.push(`/miner/customers/${c.id}`)}
                >
                  {/* Left */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-gray-600">{getInitials(c.full_name)}</span>
                    </div>
                    <div>
                      <div className="text-sm text-gray-900 font-medium">{c.full_name}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{c.national_id}</span>
                        <span className="text-xs text-gray-400">{c.total_transactions} transaction{c.total_transactions !== 1 ? 's' : ''}</span>
                        {c.last_transaction && (
                          <span className="text-xs text-gray-400">Last: {fmtDate(c.last_transaction)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2">
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
                    <span className={RISK_STYLE[c.risk_level] ?? 'text-xs text-gray-500'}>
                      {c.risk_level.charAt(0).toUpperCase() + c.risk_level.slice(1)}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-3.5 h-3.5 text-gray-300"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
