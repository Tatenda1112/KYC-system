'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';
import { fmtDate, fmtDatetime } from '../../../../lib/date';

interface CustomerProfileTransaction {
  id: number;
  created_at: string;
  transaction_date: string;
  gold_weight_grams: number;
  sale_amount_usd: number;
  buying_centre: string;
  buyer_name: string;
  payment_method: string;
  buyer_verified: boolean;
  cdd_completed: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  miner_reg_number: string | null;
}

interface CustomerProfile {
  customer: {
    id: number;
    created_at: string;
    updated_at: string;
    miner_reg_number: string | null;
    full_name: string;
    national_id: string;
    date_of_birth: string | null;
    nationality: string | null;
    phone_number: string | null;
    email: string | null;
    physical_address: string | null;
    occupation: string | null;
    employer: string | null;
    place_of_work: string | null;
    source_of_funds: string | null;
    purpose_of_purchase: string | null;
    transaction_frequency: string | null;
    politically_exposed: boolean;
    pep_details: string | null;
    known_sanctions: boolean;
    sanctions_details: string | null;
    compliance_level: number;
    risk_level: string;
    is_flagged: boolean;
    flag_reason: string | null;
    first_seen: string | null;
    last_transaction: string | null;
    total_transactions: number;
    total_value_usd: number;
  };
  miner_full_name: string | null;
  miner_district: string | null;
  transaction_count: number;
  total_spend_usd: number;
  average_spend_usd: number;
  average_gold_weight_grams: number;
  largest_transaction_usd: number;
  last_90d_transaction_count: number;
  last_90d_spend_usd: number;
  transactions: CustomerProfileTransaction[];
}

function fmtCurrency(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function riskBadgeClass(risk: string) {
  if (risk === 'high') return 'bg-gray-900 text-white';
  if (risk === 'medium') return 'bg-gray-200 text-gray-700';
  return 'bg-gray-100 text-gray-600';
}

export default function MinerCustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minerName, setMinerName] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [submittingStr, setSubmittingStr] = useState(false);
  const [strStatus, setStrStatus] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('minerName') ?? '';
    const kyc = localStorage.getItem('minerKycStatus') ?? '';
    const reg = localStorage.getItem('minerRegNumber');
    setMinerName(name);
    setMinerKycStatus(kyc);
    setMinerRegNumber(reg);

    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((user) => {
          if (user?.full_name) {
            setMinerName(user.full_name);
            localStorage.setItem('minerName', user.full_name);
          }
          if (user?.miner_kyc_status) {
            setMinerKycStatus(user.miner_kyc_status);
            localStorage.setItem('minerKycStatus', user.miner_kyc_status);
          }
          if (user?.miner_reg_number) {
            setMinerRegNumber(user.miner_reg_number);
            localStorage.setItem('minerRegNumber', user.miner_reg_number);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetch(`/api/customers/${id}/profile?limit=25`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(data?.detail ?? 'Failed to load customer profile');
        }
        setProfile(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load customer profile');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mycustomers" userName={minerName || undefined} />
        <div className="flex-1 bg-gray-50 p-5">
          <div className="h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mycustomers" userName={minerName || undefined} />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-sm text-gray-700">{error || 'Customer not found'}</div>
            <button
              type="button"
              onClick={() => router.push('/miner/customers')}
              className="mt-3 text-xs text-gray-500 underline"
            >
              Back to customers
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { customer } = profile;

  const handleSubmitStr = async () => {
    setStrStatus('');
    setSubmittingStr(true);
    const defaultReason =
      customer.flag_reason ||
      (customer.risk_level === 'high'
        ? 'High-risk customer profile requires suspicious transaction review'
        : 'Suspicious activity observed');
    const reason = window.prompt('Enter STR reason (required):', defaultReason);
    if (!reason || !reason.trim()) {
      setSubmittingStr(false);
      return;
    }
    try {
      const res = await fetch(`/api/customers/${customer.id}/str`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          filed_by: minerRegNumber ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Failed to submit STR');
      setStrStatus(`STR submitted: ${data.str_reference ?? 'reference generated'}`);
    } catch (err) {
      setStrStatus(err instanceof Error ? err.message : 'Failed to submit STR');
    } finally {
      setSubmittingStr(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        role="miner"
        activePage="mycustomers"
        userName={minerName || undefined}
        kycStatus={minerKycStatus || undefined}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/miner/customers')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              My customers
            </button>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-800">{customer.full_name}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/miner/transactions/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.full_name)}&customer_national_id=${encodeURIComponent(customer.national_id)}&customer_risk=${customer.risk_level}&customer_flagged=${customer.is_flagged}`,
              )
            }
            className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-800"
          >
            Record sale
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-5 space-y-4">
          {error && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-600">
              {error}
            </div>
          )}
          {strStatus && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-600">
              {strStatus}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-medium text-gray-900">{customer.full_name}</div>
                <div className="text-xs text-gray-400 mt-1">ID: {customer.national_id}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Customer since {fmtDatetime(customer.created_at)}
                </div>
              </div>
              <div className="flex gap-2">
                {(customer.is_flagged || customer.politically_exposed || customer.known_sanctions || customer.risk_level === 'high') && (
                  <button
                    type="button"
                    onClick={handleSubmitStr}
                    disabled={submittingStr}
                    className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-800 bg-red-100 disabled:opacity-60"
                  >
                    {submittingStr ? 'Submitting STR...' : 'File STR'}
                  </button>
                )}
                <span
                  className={`text-xs capitalize px-2 py-0.5 rounded ${riskBadgeClass(customer.risk_level)}`}
                >
                  {customer.risk_level}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  Compliance {customer.compliance_level}/100
                </span>
                {customer.is_flagged && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-900 text-white">
                    Flagged
                  </span>
                )}
                {customer.politically_exposed && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                    PEP
                  </span>
                )}
              </div>
            </div>
            {(customer.flag_reason || customer.sanctions_details) && (
              <div className="mt-3 border-l-2 border-gray-400 bg-gray-50 px-3 py-2 text-xs text-gray-600 rounded-r">
                {customer.flag_reason || customer.sanctions_details}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400">Total spend</div>
              <div className="text-lg text-gray-900 font-medium mt-1">
                ${fmtCurrency(profile.total_spend_usd)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400">Transactions</div>
              <div className="text-lg text-gray-900 font-medium mt-1">
                {profile.transaction_count}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400">Avg spend</div>
              <div className="text-lg text-gray-900 font-medium mt-1">
                ${fmtCurrency(profile.average_spend_usd)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400">Largest purchase</div>
              <div className="text-lg text-gray-900 font-medium mt-1">
                ${fmtCurrency(profile.largest_transaction_usd)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400">Last 90 days</div>
              <div className="text-lg text-gray-900 font-medium mt-1">
                ${fmtCurrency(profile.last_90d_spend_usd)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {profile.last_90d_transaction_count} transactions
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Profile details
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Phone</span>
                  <span className="text-gray-700">{customer.phone_number ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Email</span>
                  <span className="text-gray-700">{customer.email ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">DOB</span>
                  <span className="text-gray-700">
                    {customer.date_of_birth ? fmtDate(customer.date_of_birth) : '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Nationality</span>
                  <span className="text-gray-700">{customer.nationality ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Source of funds</span>
                  <span className="text-gray-700">{customer.source_of_funds ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Avg gold weight</span>
                  <span className="text-gray-700">
                    {profile.average_gold_weight_grams.toFixed(2)} g
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Compliance notes
              </div>
              <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
                <div>
                  Purpose of purchase: <span className="text-gray-800">{customer.purpose_of_purchase ?? '-'}</span>
                </div>
                <div>
                  Expected frequency: <span className="text-gray-800">{customer.transaction_frequency ?? '-'}</span>
                </div>
                <div>
                  Known sanctions: <span className="text-gray-800">{customer.known_sanctions ? 'Yes' : 'No'}</span>
                </div>
                {customer.pep_details && <div>PEP details: {customer.pep_details}</div>}
                {customer.sanctions_details && <div>Sanctions details: {customer.sanctions_details}</div>}
                <div>
                  Last transaction:{' '}
                  <span className="text-gray-800">
                    {customer.last_transaction ? fmtDate(customer.last_transaction) : 'No transactions yet'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recent purchase history
              </div>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Date</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Amount</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Gold</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Payment</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">CDD</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {profile.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                      No transactions recorded for this customer yet.
                    </td>
                  </tr>
                ) : (
                  profile.transactions.map((txn) => (
                    <tr key={txn.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-xs text-gray-700">
                        {fmtDate(txn.transaction_date)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">
                        ${fmtCurrency(txn.sale_amount_usd)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">
                        {txn.gold_weight_grams.toFixed(2)} g
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700 capitalize">
                        {txn.payment_method}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">
                        {txn.cdd_completed ? 'Completed' : 'Incomplete'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">
                        {txn.is_flagged ? (
                          <span className="px-2 py-0.5 rounded bg-gray-900 text-white">Flagged</span>
                        ) : (
                          'Clear'
                        )}
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
