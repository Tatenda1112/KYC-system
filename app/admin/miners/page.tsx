'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface Miner {
  id: string;
  regNumber: string;
  fullName: string;
  district: string;
  regType: string;
  kycStatus: string;
  score: number;
  risk: string;
}

interface DeleteTarget {
  id: string;
  fullName: string;
  regNumber: string;
}

export default function MinersListPage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    district: 'all',
    kycStatus: 'all',
    regType: 'all',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();

  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    const fetchMiners = async () => {
      try {
        const res = await fetch(`${BACKEND}/miners/registrations`);
        if (!res.ok) throw new Error('Failed to fetch registrations');
        const data: {
          id: number;
          reg_number: string;
          full_name: string;
          district: string;
          registration_type: string;
          kyc_status: string;
          score: number;
          risk: string;
        }[] = await res.json();
        setMiners(
          data.map(m => ({
            id: String(m.id),
            regNumber: m.reg_number,
            fullName: m.full_name,
            district: m.district,
            regType: m.registration_type,
            kycStatus: m.kyc_status,
            score: m.score,
            risk: m.risk,
          })),
        );
      } catch (err) {
        console.error('Could not load miners:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMiners();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${BACKEND}/miners/registrations/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Delete failed');
      }
      setMiners(prev => prev.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filteredMiners = miners.filter(miner => {
    const matchesDistrict =
      filters.district === 'all' || miner.district === filters.district;
    const matchesStatus =
      filters.kycStatus === 'all' ||
      miner.kycStatus.toLowerCase() === filters.kycStatus.toLowerCase();
    const matchesType =
      filters.regType === 'all' || miner.regType === filters.regType;
    const matchesSearch =
      !filters.search ||
      miner.fullName.toLowerCase().includes(filters.search.toLowerCase()) ||
      miner.regNumber.toLowerCase().includes(filters.search.toLowerCase());
    return matchesDistrict && matchesStatus && matchesType && matchesSearch;
  });

  const pendingMiners = miners.filter(miner => miner.kycStatus.toLowerCase() === 'pending');

  const totalPages = Math.ceil(filteredMiners.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentMiners = filteredMiners.slice(startIndex, endIndex);

  const getRiskStyle = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high':   return 'text-red-700 font-semibold text-xs';
      case 'medium': return 'text-amber-700 font-semibold text-xs';
      case 'low':    return 'text-emerald-700 font-semibold text-xs';
      default:       return 'text-slate-500 font-medium text-xs';
    }
  };

  const getRowStyle = (kycStatus: string) =>
    kycStatus.toLowerCase() === 'flagged' ? 'bg-gray-50' : '';

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified':  return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'pending':   return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'flagged':   return 'bg-red-100 text-red-800 border border-red-300';
      case 'rejected':  return 'bg-rose-100 text-rose-800 border border-rose-300';
      default:          return 'bg-slate-100 text-slate-700 border border-slate-300';
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="miners" />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">Registered miners</div>
            <div className="text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
              {loading ? '…' : `${miners.length} total`}
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/users/new')}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            + Add miner
          </button>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2 flex-wrap">
          <select
            value={filters.district}
            onChange={e => handleFilterChange('district', e.target.value)}
            className="h-8 text-xs border border-slate-300 rounded bg-white px-2 text-slate-700"
          >
            <option value="all">All districts</option>
            <option value="Kadoma">Kadoma</option>
            <option value="Ngezi">Ngezi</option>
            <option value="Shurugwi">Shurugwi</option>
            <option value="Zvishavane">Zvishavane</option>
            <option value="Gwanda">Gwanda</option>
          </select>

          <select
            value={filters.kycStatus}
            onChange={e => handleFilterChange('kycStatus', e.target.value)}
            className="h-8 text-xs border border-slate-300 rounded bg-white px-2 text-slate-700"
          >
            <option value="all">All status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filters.regType}
            onChange={e => handleFilterChange('regType', e.target.value)}
            className="h-8 text-xs border border-slate-300 rounded bg-white px-2 text-slate-700"
          >
            <option value="all">All types</option>
            <option value="Cooperative">Cooperative</option>
            <option value="Individual Licence">Individual Licence</option>
            <option value="Company">Company</option>
            <option value="Syndicate">Syndicate</option>
          </select>

          <input
            type="text"
            placeholder="Search by name or reg number..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className="flex-1 h-8 border border-slate-300 rounded bg-white px-3 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
          />
        </div>

        {!loading && pendingMiners.length > 0 && (
          <div className="mx-5 mt-4 border-l-2 border-gray-500 bg-white rounded-r px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Pending verification</div>
              <div className="text-xs text-gray-400 mt-1">
                {pendingMiners.length} miner{pendingMiners.length > 1 ? 's' : ''} waiting for admin review and approval.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange('kycStatus', 'pending')}
                className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 transition"
              >
                Show pending
              </button>
              <button
                onClick={() => router.push(`/admin/miners/${pendingMiners[0].id}`)}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 transition"
              >
                Review next
              </button>
            </div>
          </div>
        )}

        {/* TABLE CONTAINER */}
        <div className="flex-1 overflow-auto">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mx-5 mt-4">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[15%]">Reg number</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[18%]">Full name</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[11%]">District</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[13%]">Type</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[11%]">KYC status</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[8%]">Score</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[9%]">Risk</th>
                  <th className="text-xs text-slate-700 uppercase tracking-wider font-semibold py-2.5 px-3 text-left w-[15%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  /* Loading skeleton rows */
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="py-2.5 px-3">
                          <div className="h-3 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : currentMiners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-gray-400">
                      {miners.length === 0
                        ? 'No miner registrations yet. Registrations will appear here once miners submit their KYC.'
                        : 'No miners match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  currentMiners.map(miner => (
                    <tr
                      key={miner.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${getRowStyle(miner.kycStatus)}`}
                    >
                      <td className="py-2.5 px-3 text-sm text-gray-700">{miner.regNumber}</td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{miner.fullName}</td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{miner.district}</td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{miner.regType}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded font-medium ${getStatusBadgeStyle(miner.kycStatus)}`}
                        >
                          {miner.kycStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-gray-700">{miner.score}/100</td>
                      <td className="py-2.5 px-3">
                        <span className={getRiskStyle(miner.risk)}>{miner.risk}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push('/admin/miners/' + miner.id)}
                            className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50 transition"
                          >
                            {miner.kycStatus.toLowerCase() === 'pending' ? 'Review / verify' : 'View profile'}
                          </button>
                          <button
                            onClick={() => { setDeleteTarget({ id: miner.id, fullName: miner.fullName, regNumber: miner.regNumber }); setDeleteError(''); }}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {!loading && filteredMiners.length > 0 && (
            <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-400">
                Showing {startIndex + 1}–{Math.min(endIndex, filteredMiners.length)} of{' '}
                {filteredMiners.length} miners
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 text-xs rounded flex items-center justify-center ${
                        pageNum === currentPage
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-80 shadow-lg">
            <div className="text-sm font-medium text-gray-900 mb-1">Delete miner</div>
            <div className="text-xs text-gray-500 mb-1">
              Permanently delete{' '}
              <span className="font-medium text-gray-700">{deleteTarget.fullName}</span>{' '}
              ({deleteTarget.regNumber})?
            </div>
            <div className="text-xs text-gray-400 mb-4 leading-relaxed">
              This will remove the registration, all recorded transactions, and all audit entries for this miner. This cannot be undone.
            </div>

            {deleteError && (
              <div className="mb-3 border-l-2 border-gray-400 bg-gray-50 pl-2.5 py-1.5 rounded-r text-xs text-gray-600">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
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
