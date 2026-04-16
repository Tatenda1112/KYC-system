'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';

interface DashboardData {
  totalMiners: number;
  verifiedMiners: number;
  pendingKyc: number;
  flaggedCount: number;
  totalTransactions: number;
  averageScore: number;
  complianceByDistrict: { district: string; score: number }[];
  flaggedTransactions: {
    miner: string;
    district: string;
    flagReason: string;
    date: string;
    amount: number;
  }[];
  registrationBreakdown: { type: string; percentage: number }[];
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-medium text-gray-900 mt-1">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('A');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUserName((u.full_name ?? u.email ?? 'A')[0].toUpperCase());
      }
    } catch {}

    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/login'); return; }

        const response = await fetch('/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load dashboard');
        }

        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [router]);

  const now = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="dashboard" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
            <div className="text-sm font-medium text-gray-800">Dashboard overview</div>
            <div className="text-gray-400 text-xs">{now}</div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 p-5">
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-gray-200 rounded-lg h-20" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg h-64" />
                <div className="bg-white border border-gray-200 rounded-lg h-64" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-gray-500">{error}</div>
            <button
              onClick={() => { setError(''); setLoading(true); }}
              className="mt-3 text-xs text-gray-400 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const verifiedPct = data!.totalMiners > 0
    ? Math.round((data!.verifiedMiners / data!.totalMiners) * 100)
    : 0;
  const pendingPct = data!.totalMiners > 0
    ? Math.round((data!.pendingKyc / data!.totalMiners) * 100)
    : 0;

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="dashboard" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="text-sm font-medium text-gray-800">Dashboard overview</div>
          <div className="flex items-center gap-3">
            <div className="text-gray-400 text-xs">{now}</div>
            <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center">
              {userName}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-5 space-y-4">

          {/* Row 1 — Stat Cards */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total miners"
              value={data!.totalMiners}
              sub={`${data!.complianceByDistrict.length} district${data!.complianceByDistrict.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Verified"
              value={data!.verifiedMiners}
              sub={`${verifiedPct}%`}
            />
            <StatCard
              label="Pending KYC"
              value={data!.pendingKyc}
              sub={`${pendingPct}%`}
            />
            <StatCard
              label="Flagged"
              value={data!.flaggedCount}
              sub="needs review"
            />
          </div>

          {/* Row 1b — secondary stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total transactions"
              value={data!.totalTransactions}
              sub="all time"
            />
            <StatCard
              label="Average compliance score"
              value={`${data!.averageScore} / 100`}
              sub="across all miners"
            />
          </div>

          {/* Row 2 — Charts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Compliance by District */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Compliance score by district
              </div>
              {data!.complianceByDistrict.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-gray-400">
                  No district data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, data!.complianceByDistrict.length * 36)}>
                  <BarChart
                    data={data!.complianceByDistrict}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#999" fontSize={11} />
                    <YAxis dataKey="district" type="category" stroke="#999" fontSize={11} width={72} />
                    <Tooltip formatter={(v: number) => [`${v}/100`, 'Avg score']} />
                    <Bar dataKey="score" fill="#1A1A1A" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Registration Type Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Registration type breakdown
              </div>
              {data!.registrationBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-gray-400">
                  No registration data yet
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {data!.registrationBreakdown.map(item => (
                    <div key={item.type} className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-700 w-28 shrink-0">{item.type}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-gray-800 transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 w-9 text-right">{item.percentage}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3 — Recent Flagged Transactions */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Recent flagged transactions
            </div>
            {data!.flaggedTransactions.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">No flagged transactions</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs text-gray-400 font-medium">Miner</th>
                      <th className="text-left py-2 text-xs text-gray-400 font-medium">District</th>
                      <th className="text-left py-2 text-xs text-gray-400 font-medium">Flag reason</th>
                      <th className="text-left py-2 text-xs text-gray-400 font-medium">Amount (USD)</th>
                      <th className="text-left py-2 text-xs text-gray-400 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.flaggedTransactions.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-xs text-gray-700">{t.miner}</td>
                        <td className="py-2 text-xs text-gray-700">{t.district}</td>
                        <td className="py-2 text-xs text-gray-500">{t.flagReason}</td>
                        <td className="py-2 text-xs text-gray-700">
                          {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 text-xs text-gray-400">{t.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={() => router.push('/admin/compliance')}
              className="text-xs text-gray-400 mt-3 hover:text-gray-600 transition-colors"
            >
              View all →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
