'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface Summary {
  total_miners: number;
  verified_miners: number;
  total_transactions: number;
  total_value_usd: number;
  flagged_transactions: number;
  high_risk_miners: number;
  generated_at: string;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/reports/summary`);
      if (res.ok) setSummary(await res.json());
    } catch (err) {
      console.error('Failed to load report summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleDownload = async (type: 'transactions' | 'miners') => {
    setDownloading(type);
    try {
      const url = `${BACKEND}/reports/export/${type}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+?)"/);
      const fname = match ? match[1] : `${type}_export.csv`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  const exports = [
    {
      id: 'transactions' as const,
      title: 'All transactions',
      description: 'Full history of gold sale transactions across all miners. Includes CDD status, payment method and flag reasons.',
      rows: loading ? null : summary?.total_transactions,
      unit: 'records',
    },
    {
      id: 'miners' as const,
      title: 'Miner registrations',
      description: 'Complete KYC registration list with compliance scores, risk levels and KYC status for all registered miners.',
      rows: loading ? null : summary?.total_miners,
      unit: 'miners',
    },
  ];

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="reports" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="text-sm font-medium text-gray-800">Reports</div>
          {summary && (
            <div className="text-xs text-gray-400">
              Last generated: {summary.generated_at}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-5">

          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total miners registered</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : summary?.total_miners ?? 0}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {loading ? '' : `${summary?.verified_miners ?? 0} KYC verified`}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total transaction volume</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : `$${fmtCurrency(summary?.total_value_usd ?? 0)}`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {loading ? '' : `across ${summary?.total_transactions ?? 0} transactions`}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">AML flags / high risk</div>
              <div className="text-2xl font-medium text-gray-900">
                {loading ? '…' : (summary?.flagged_transactions ?? 0)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {loading ? '' : `flagged txns · ${summary?.high_risk_miners ?? 0} high-risk miners`}
              </div>
            </div>
          </div>

          {/* EXPORT SECTION */}
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3 px-1">
              Export data
            </div>
            <div className="grid grid-cols-2 gap-4">
              {exports.map(exp => (
                <div
                  key={exp.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-1">{exp.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed mb-4">
                      {exp.description}
                    </div>
                    {exp.rows !== null && (
                      <div className="text-xs text-gray-500 mb-4">
                        {exp.rows} {exp.unit} available
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDownload(exp.id)}
                    disabled={downloading === exp.id}
                    className="w-full bg-gray-900 text-white text-xs py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {downloading === exp.id ? (
                      'Generating…'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Download CSV
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FORMAT note */}
          <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2.5 rounded-r mx-0 mt-4">
            <div className="text-xs text-gray-500 leading-relaxed">
              Exports are CSV files compatible with Microsoft Excel, Google Sheets, and other
              spreadsheet tools. Data reflects the current state of the database at download time.
            </div>
          </div>

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}
