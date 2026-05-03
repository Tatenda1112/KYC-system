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

const STATUS_OPTIONS: Array<StrReport['status']> = ['Submitted', 'Under Review', 'Escalated', 'Closed'];

export default function AdminStrPage() {
  const [reports, setReports] = useState<StrReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/str', { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error('Failed to load STR reports');
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load STR reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const updateStatus = async (id: number, status: StrReport['status']) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/str/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewed_by: 'admin' }),
      });
      if (!res.ok) throw new Error('Failed to update STR status');
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update STR status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="str" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">Suspicious Transaction Reports (STR)</div>
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
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[28%]">Reason</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Filed by</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[12%]">Created</th>
                  <th className="text-xs text-gray-500 uppercase tracking-wider font-medium py-2.5 px-3 text-left w-[16%]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-2.5 px-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-gray-400">No STR reports submitted yet.</td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2.5 px-3 text-xs font-mono text-gray-700">{r.reference}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-gray-500">{r.customer_number ?? r.customer_national_id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-700">{r.reason}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">{r.filed_by}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={r.status}
                          disabled={updatingId === r.id}
                          onChange={(e) => updateStatus(r.id, e.target.value as StrReport['status'])}
                          className="h-8 text-xs border border-gray-200 rounded bg-white px-2 text-gray-700"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
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
