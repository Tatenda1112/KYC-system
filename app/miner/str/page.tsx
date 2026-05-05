'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';

interface StrReport {
  id: number;
  created_at: string;
  reference: string;
  customer_id: number;
  customer_number: string | null;
  customer_name: string;
  customer_national_id: string;
  reason: string;
  note: string | null;
  status: 'Submitted' | 'Under Review' | 'Escalated' | 'Closed';
  filed_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const STATUS_BADGE: Record<StrReport['status'], string> = {
  Submitted: 'bg-gray-200 text-gray-700',
  'Under Review': 'bg-blue-100 text-blue-800',
  Escalated: 'bg-red-100 text-red-800',
  Closed: 'bg-emerald-100 text-emerald-800',
};

export default function MinerStrPage() {
  const [reports, setReports] = useState<StrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minerName, setMinerName] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const reg = localStorage.getItem('minerRegNumber');
        const name = localStorage.getItem('minerName') ?? '';
        setMinerName(name);
        if (!reg) {
          setReports([]);
          return;
        }

        const token = localStorage.getItem('token');
        if (token) {
          const me = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }).then(r => (r.ok ? r.json() : null));
          if (me?.full_name) {
            setMinerName(me.full_name);
            localStorage.setItem('minerName', me.full_name);
          }
        }

        const res = await fetch(`/api/miner/str?filed_by=${encodeURIComponent(reg)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error('Failed to load STR reports');
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load STR reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="str" userName={minerName || undefined} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">STR Centre</div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          {error && (
            <div className="mb-4 border-l-2 border-gray-400 bg-white rounded-r px-3 py-2">
              <div className="text-xs text-gray-600">{error}</div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[14%]">Reference</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[18%]">Customer</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[30%]">Reason</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Created</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Status</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[14%]">Reviewed by</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-2.5 px-3">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-gray-400">
                      No STR reports filed yet.
                    </td>
                  </tr>
                ) : (
                  reports.map(r => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2.5 px-3 text-xs font-mono text-gray-700">{r.reference}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-gray-500">{r.customer_number ?? r.customer_national_id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">{r.reason}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">
                        {r.reviewed_by ?? '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
