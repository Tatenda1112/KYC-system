'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

const inputBase =
  'h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800';

interface ExistingCustomer {
  id: number;
  full_name: string;
  national_id: string;
  total_transactions: number;
  risk_level: string;
  is_flagged: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const CddToggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => onChange(true)}
      className={`px-4 py-1.5 rounded text-xs transition ${
        value
          ? 'bg-gray-900 text-white'
          : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      YES
    </button>
    <button
      type="button"
      onClick={() => onChange(false)}
      className={`px-4 py-1.5 rounded text-xs transition ${
        !value
          ? 'bg-gray-900 text-white'
          : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      NO
    </button>
  </div>
);

export default function AddCustomerPage() {
  const router = useRouter();

  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);
  const [minerName, setMinerName] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');

  // Check existing customer
  const [checkInput, setCheckInput] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkDone, setCheckDone] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [placeOfWork, setPlaceOfWork] = useState('');
  const [sourceOfFunds, setSourceOfFunds] = useState('');
  const [purposeOfPurchase, setPurposeOfPurchase] = useState('');
  const [politicallyExposed, setPoliticallyExposed] = useState(false);
  const [pepDetails, setPepDetails] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
  }, []);

  const handleCheck = async () => {
    if (!checkInput.trim()) return;
    setCheckLoading(true);
    setCheckDone(false);
    setExistingCustomer(null);
    try {
      const params = new URLSearchParams({ national_id: checkInput.trim() });
      if (minerRegNumber) params.set('miner_reg_number', minerRegNumber);
      const res = await fetch(`/api/customers/check?${params}`, { cache: 'no-store' });
      const data = await res.json();
      setExistingCustomer(data ?? null);
      setCheckDone(true);
    } catch {
      setCheckDone(true);
      setExistingCustomer(null);
    } finally {
      setCheckLoading(false);
    }
  };

  const useExistingCustomer = (c: ExistingCustomer) => {
    router.push(
      `/miner/transactions/new?customer_id=${c.id}&customer_name=${encodeURIComponent(c.full_name)}&customer_national_id=${encodeURIComponent(c.national_id)}&customer_risk=${c.risk_level}&customer_flagged=${c.is_flagged}`,
    );
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!fullName.trim()) e.fullName = 'This field is required';
    if (!nationalId.trim()) e.nationalId = 'This field is required';
    if (politicallyExposed && !pepDetails.trim()) e.pepDetails = 'Please describe the PEP connection';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError('');
    setIsSubmitting(true);

    const payload = {
      miner_reg_number: minerRegNumber ?? null,
      full_name: fullName.trim(),
      national_id: nationalId.trim(),
      phone_number: phone.trim() || null,
      email: email.trim() || null,
      physical_address: address.trim() || null,
      occupation: occupation.trim() || null,
      employer: employer.trim() || null,
      place_of_work: placeOfWork.trim() || null,
      source_of_funds: sourceOfFunds.trim() || null,
      purpose_of_purchase: purposeOfPurchase || null,
      politically_exposed: politicallyExposed,
      pep_details: pepDetails.trim() || null,
    };

    try {
      const res = await fetch(`${BACKEND}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Failed to save customer');
      }
      const customer = await res.json();
      router.push(
        `/miner/transactions/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.full_name)}&customer_national_id=${encodeURIComponent(customer.national_id)}&customer_risk=${customer.risk_level}&customer_flagged=${customer.is_flagged}`,
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save customer. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (field: string) =>
    `${inputBase} ${errors[field] ? 'border-gray-800' : 'border-gray-200'}`;

  if (minerKycStatus && minerKycStatus !== 'Verified') {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="mycustomers" kycStatus={minerKycStatus} userName={minerName || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">Add new customer</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="text-sm font-medium text-gray-800 mb-2">Entry locked</div>
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
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">Add new customer</div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-lg p-6">

              {/* CDD requirement info box */}
              <div className="border-l-2 border-gray-300 pl-3 mb-5">
                <div className="text-xs font-medium text-gray-600 mb-1">CDD requirement</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  You must record details of every person who purchases gold from you before
                  completing the transaction. This is your Customer Due Diligence (CDD) obligation
                  under the Money Laundering and Proceeds of Crime Act (Zimbabwe) and FATF
                  Recommendations (2024).
                </div>
              </div>

              {/* CHECK EXISTING CUSTOMER */}
              <div className="mb-2">
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Check if customer is already registered
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={checkInput}
                    onChange={e => { setCheckInput(e.target.value); setCheckDone(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleCheck()}
                    placeholder="Enter national ID number to check..."
                    className={`${inputBase} border-gray-200 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleCheck}
                    disabled={checkLoading || !checkInput.trim()}
                    className="h-9 px-4 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {checkLoading ? '…' : 'Check'}
                  </button>
                </div>

                {checkDone && existingCustomer && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-gray-700 font-medium">{existingCustomer.full_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Already registered · {existingCustomer.total_transactions} previous transaction
                        {existingCustomer.total_transactions !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => useExistingCustomer(existingCustomer)}
                      className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-800 transition"
                    >
                      Use this customer
                    </button>
                  </div>
                )}

                {checkDone && !existingCustomer && (
                  <div className="text-xs text-gray-400 mt-2">
                    No existing customer found. Please complete the form below.
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 my-5" />

              {/* CUSTOMER DETAILS FORM */}
              <div className="space-y-4">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Customer details
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Full name <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: '' })); }}
                      className={fieldClass('fullName')}
                      placeholder="e.g. Tatenda Moyo"
                    />
                    {errors.fullName && (
                      <div className="text-xs text-gray-500 mt-1">{errors.fullName}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      National ID number <span className="text-gray-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={nationalId}
                      onChange={e => { setNationalId(e.target.value); if (errors.nationalId) setErrors(p => ({ ...p, nationalId: '' })); }}
                      className={fieldClass('nationalId')}
                      placeholder="e.g. 63-123456A78"
                    />
                    {errors.nationalId && (
                      <div className="text-xs text-gray-500 mt-1">{errors.nationalId}</div>
                    )}
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Phone number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. +263 77 123 4567"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Email address <span className="text-gray-300">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. tatenda@email.com"
                    />
                  </div>
                </div>

                {/* Full width */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Physical address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className={`${inputBase} border-gray-200`}
                    placeholder="e.g. 14 Baines Ave, Harare"
                  />
                </div>

                {/* Row 3 — Occupation & Source of funds */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Occupation</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={e => setOccupation(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. Gold dealer, Businessman"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Source of funds</label>
                    <input
                      type="text"
                      value={sourceOfFunds}
                      onChange={e => setSourceOfFunds(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. Business income, Salary"
                    />
                  </div>
                </div>

                {/* Row 4 — Employer & Place of work */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Employer</label>
                    <input
                      type="text"
                      value={employer}
                      onChange={e => setEmployer(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. Fidelity Gold Refinery"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Place of work</label>
                    <input
                      type="text"
                      value={placeOfWork}
                      onChange={e => setPlaceOfWork(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                      placeholder="e.g. Kwekwe Industrial Area"
                    />
                  </div>
                </div>

                {/* Purpose of purchase */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Purpose of purchase</label>
                  <select
                    value={purposeOfPurchase}
                    onChange={e => setPurposeOfPurchase(e.target.value)}
                    className={`${inputBase} border-gray-200`}
                  >
                    <option value="">Select purpose...</option>
                    <option value="Personal investment">Personal investment</option>
                    <option value="Business / resale">Business / resale</option>
                    <option value="Export">Export</option>
                    <option value="Jewellery manufacturing">Jewellery manufacturing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-100 my-5" />

              {/* RISK ASSESSMENT */}
              <div className="space-y-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Risk assessment
                </div>

                {/* PEP toggle row */}
                <div className="flex items-center justify-between py-3 border border-gray-100 rounded-lg px-4">
                  <div>
                    <div className="text-sm text-gray-800 font-medium">
                      Is this customer a politically exposed person (PEP)?
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Government officials, politicians, senior public figures or their associates
                    </div>
                  </div>
                  <CddToggle value={politicallyExposed} onChange={setPoliticallyExposed} />
                </div>

                {/* PEP details */}
                {politicallyExposed && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">PEP details</label>
                      <textarea
                        value={pepDetails}
                        onChange={e => { setPepDetails(e.target.value); if (errors.pepDetails) setErrors(p => ({ ...p, pepDetails: '' })); }}
                        className={`w-full border rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800 min-h-20 ${errors.pepDetails ? 'border-gray-800' : 'border-gray-200'}`}
                        placeholder="Describe their political position or connection..."
                      />
                      {errors.pepDetails && (
                        <div className="text-xs text-gray-500 mt-1">{errors.pepDetails}</div>
                      )}
                    </div>

                    <div className="bg-gray-900 text-white rounded-lg p-3">
                      <div className="text-xs leading-relaxed">
                        Politically exposed persons require enhanced due diligence. This customer
                        will be automatically flagged for compliance review. You must obtain
                        additional documentation and approval before proceeding.
                      </div>
                    </div>
                  </>
                )}
              </div>

              {submitError && (
                <div className="mt-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                  {submitError}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/miner/customers')}
                  className="flex-1 h-9 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-900 text-white text-sm py-2.5 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving…' : 'Save customer'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
