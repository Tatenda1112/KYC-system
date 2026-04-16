'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';
import { fmtDatetime } from '../../../../lib/date';
import StatusBadge from '../../../../components/StatusBadge';
import ScoreBar from '../../../../components/ScoreBar';

const BACKEND = 'http://localhost:8000';

// Shape returned by GET /miners/registrations/{id}
interface MinerRegistrationOut {
  id: number;
  reg_number: string;
  created_at: string;
  full_name: string;
  national_id: string;
  district: string;
  years_of_operation: string;
  education_level: string;
  registration_type: string;
  mining_reg_number: string;
  owner_full_name: string;
  owner_national_id: string;
  owner_relationship: string;
  owner_phone: string;
  owner_email: string | null;
  owner_address: string;
  declaration_confirmed: boolean;
  kyc_status: string;
  score: number;
  risk: string;
  national_id_doc: string | null;
  registration_cert_doc: string | null;
  proof_of_address_doc: string | null;
}

type KycStatus = 'Pending' | 'Verified' | 'Flagged' | 'Rejected';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Distribute a total score (0-100) proportionally across the 4 categories. */
function computeBreakdown(score: number) {
  const identity     = Math.min(25, Math.round(score * 0.25));
  const documents    = Math.min(20, Math.round(score * 0.20));
  const transactions = Math.min(35, Math.round(score * 0.35));
  const banking      = Math.min(20, score - identity - documents - transactions);
  return { identity, documents, transactions, banking: Math.max(0, banking) };
}

export default function MinerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [miner, setMiner] = useState<MinerRegistrationOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Status-update modal
  const [showModal, setShowModal] = useState(false);
  const [newStatus, setNewStatus] = useState<KycStatus>('Pending');
  const [newScore, setNewScore] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState('');

  const router = useRouter();

  const fetchMiner = async () => {
    try {
      const res = await fetch(`${BACKEND}/miners/registrations/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error('Fetch failed');
      const data: MinerRegistrationOut = await res.json();
      setMiner(data);
      setNewStatus(data.kyc_status as KycStatus);
      setNewScore(String(data.score));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMiner(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A registration is considered submitted when the core identity fields are present.
  // Documents are optional at submission time and should not block admin approval.
  const kycRegistrationSubmitted = (m: MinerRegistrationOut): boolean =>
    !!(m.full_name && m.national_id && m.district);

  const handleUpdateStatus = async () => {
    if (!miner) return;
    setModalError('');

    if (newStatus === 'Verified' && !kycRegistrationSubmitted(miner)) {
      setModalError('Cannot verify: this miner has not submitted a KYC registration form.');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(
        `${BACKEND}/miners/registrations/${miner.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kyc_status: newStatus,
            score: newScore ? parseInt(newScore, 10) : undefined,
          }),
        },
      );
      if (!res.ok) throw new Error('Update failed');
      const updated: MinerRegistrationOut = await res.json();
      setMiner(updated);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setModalError('Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="miners" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm text-gray-400">Loading…</div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 p-5">
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-[220px_1fr] gap-4">
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg h-56" />
                  <div className="bg-white border border-gray-200 rounded-lg h-28" />
                  <div className="bg-white border border-gray-200 rounded-lg h-32" />
                </div>
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg h-40" />
                  <div className="bg-white border border-gray-200 rounded-lg h-64" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !miner) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="miners" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
            <div className="text-sm text-gray-800 font-medium">Miner not found</div>
            <button
              onClick={() => router.push('/admin/miners')}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50"
            >
              ← Back to miners
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-gray-500">
                Registration #{id} does not exist.
              </div>
              <button
                onClick={() => router.push('/admin/miners')}
                className="mt-4 text-xs text-gray-500 underline"
              >
                View all miners
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const breakdown = computeBreakdown(miner.score);

  const kycDocs = [
    {
      id: 'national_id',
      name: 'National ID (front and back)',
      status: miner.national_id_doc ? 'uploaded' : 'pending',
      filename: miner.national_id_doc,
    },
    {
      id: 'certificate',
      name: 'Mining registration certificate',
      status: miner.registration_cert_doc ? 'uploaded' : 'pending',
      filename: miner.registration_cert_doc,
    },
    {
      id: 'proof_of_address',
      name: 'Proof of address',
      status: miner.proof_of_address_doc ? 'uploaded' : 'pending',
      filename: miner.proof_of_address_doc,
    },
  ];

  const registeredOn = fmtDatetime(miner.created_at);

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="miners" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/admin/miners')}
              className="text-gray-400 text-sm hover:text-gray-600"
            >
              Miners
            </button>
            <div className="text-gray-300 text-sm">/</div>
            <div className="text-gray-800 text-sm font-medium">{miner.full_name}</div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            Review / approve KYC
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="grid grid-cols-[220px_1fr] gap-4">

            {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Identity card */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center">
                  {getInitials(miner.full_name)}
                </div>
                <div className="text-gray-900 text-sm font-medium mt-2.5">{miner.full_name}</div>
                <div className="text-gray-400 text-xs mt-0.5 mb-3">{miner.reg_number}</div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">District</div>
                    <div className="text-xs text-gray-700">{miner.district}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">Type</div>
                    <div className="text-xs text-gray-700">{miner.registration_type}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">Education</div>
                    <div className="text-xs text-gray-700">{miner.education_level}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">Years active</div>
                    <div className="text-xs text-gray-700">{miner.years_of_operation}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">Reg date</div>
                    <div className="text-xs text-gray-700">{registeredOn}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-xs text-gray-400">Mining reg no.</div>
                    <div className="text-xs text-gray-700 truncate ml-2">{miner.mining_reg_number}</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center">
                  <div className="text-xs text-gray-400">KYC Status</div>
                  <StatusBadge status={miner.kyc_status} />
                </div>
              </div>

              {/* Compliance score */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Compliance score
                </div>
                <div className="flex items-baseline">
                  <div className="text-3xl font-medium text-gray-900">{miner.score}</div>
                  <div className="text-sm text-gray-300 ml-1">/100</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{miner.risk} risk</div>
              </div>

              {/* KYC documents */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  KYC documents
                </div>
                <div className="space-y-2">
                  {kycDocs.map(doc => (
                    <div
                      key={doc.id}
                      className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="pr-2">
                        <div className="text-xs text-gray-600 leading-relaxed">{doc.name}</div>
                        {doc.filename && (
                          <a
                            href={`/api/admin/miners/${miner.id}/documents/${doc.id}`}
                            className="text-xs text-gray-400 underline hover:text-gray-600 mt-1 inline-block"
                          >
                            Download {doc.filename}
                          </a>
                        )}
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Score breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Score breakdown
                </div>
                <div className="space-y-3">
                  <ScoreBar label="Identity verification" score={breakdown.identity}     maxScore={25} />
                  <ScoreBar label="Documents uploaded"    score={breakdown.documents}    maxScore={20} />
                  <ScoreBar label="Transaction history"   score={breakdown.transactions} maxScore={35} />
                  <ScoreBar label="Formal banking"        score={breakdown.banking}      maxScore={20} />
                </div>
              </div>

              {/* Beneficial owner */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Beneficial owner
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {[
                    ['Full name',     miner.owner_full_name],
                    ['National ID',   miner.owner_national_id],
                    ['Relationship',  miner.owner_relationship],
                    ['Phone',         miner.owner_phone],
                    ['Email',         miner.owner_email ?? '—'],
                    ['Address',       miner.owner_address],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="text-xs text-gray-700 mt-0.5 break-words">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction history — empty until transactions are linked */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Transaction history
                </div>
                <div className="py-6 text-center text-xs text-gray-400">
                  No transactions recorded yet for this miner.
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── UPDATE STATUS MODAL ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-80 shadow-lg">
            <div className="text-sm font-medium text-gray-900 mb-4">Update KYC status</div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">KYC status</label>
                <select
                  value={newStatus}
                  onChange={e => {
                    setNewStatus(e.target.value as KycStatus);
                    setModalError('');
                  }}
                  className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
                >
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Flagged">Flagged</option>
                  <option value="Rejected">Rejected</option>
                </select>

              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Compliance score (0–100)
                  <span className="text-gray-400 ml-1">optional</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newScore}
                  onChange={e => setNewScore(e.target.value)}
                  className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
                  placeholder={String(miner.score)}
                />
              </div>
            </div>

            {modalError && (
              <div className="mt-4 border-l-2 border-gray-400 bg-gray-50 pl-3 py-2 rounded-r text-xs text-gray-600 leading-relaxed">
                {modalError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowModal(false); setModalError(''); }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={updating}
                className="flex-1 bg-gray-900 text-white text-sm py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updating ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
