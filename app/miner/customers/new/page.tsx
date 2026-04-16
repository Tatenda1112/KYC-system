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

const YesNoToggle = ({
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 pt-1">
      {children}
    </div>
  );
}

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

  // ── Identity
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');

  // ── Contact
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  // ── Financial
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [sourceOfFunds, setSourceOfFunds] = useState('');
  const [purposeOfPurchase, setPurposeOfPurchase] = useState('');
  const [transactionFrequency, setTransactionFrequency] = useState('');

  // ── Risk
  const [politicallyExposed, setPoliticallyExposed] = useState(false);
  const [pepDetails, setPepDetails] = useState('');
  const [knownSanctions, setKnownSanctions] = useState(false);
  const [sanctionsDetails, setSanctionsDetails] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // CDD ref for display (form instance identifier)
  const [cddRef] = useState(() => {
    const ts = Date.now();
    return `CDD-${ts.toString().slice(-8)}`;
  });
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

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
      const reg = localStorage.getItem('minerRegNumber');
      if (reg) params.set('miner_reg_number', reg);
      const res = await fetch(`/api/customers/check?${params}`, { cache: 'no-store' });
      const data = await res.json();
      setExistingCustomer(data ?? null);
      setCheckDone(true);
    } catch {
      setCheckDone(true);
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
    if (!fullName.trim()) e.fullName = 'Required';
    if (!nationalId.trim()) e.nationalId = 'Required';
    if (politicallyExposed && !pepDetails.trim()) e.pepDetails = 'Describe the PEP connection';
    if (knownSanctions && !sanctionsDetails.trim()) e.sanctionsDetails = 'Describe the sanctions';
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
      date_of_birth: dateOfBirth || null,
      nationality: nationality.trim() || null,
      phone_number: phone.trim() || null,
      email: email.trim() || null,
      physical_address: address.trim() || null,
      occupation: occupation.trim() || null,
      employer: employer.trim() || null,
      source_of_funds: sourceOfFunds || null,
      purpose_of_purchase: purposeOfPurchase || null,
      transaction_frequency: transactionFrequency || null,
      politically_exposed: politicallyExposed,
      pep_details: pepDetails.trim() || null,
      known_sanctions: knownSanctions,
      sanctions_details: sanctionsDetails.trim() || null,
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

  const fc = (field: string) =>
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
          <div className="max-w-2xl mx-auto space-y-4">

            {/* CDD requirement banner */}
            <div className="border-l-2 border-gray-300 bg-white pl-3 py-2.5 rounded-r">
              <div className="text-xs font-medium text-gray-600 mb-0.5">CDD requirement</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Record details of every gold buyer before completing the transaction — Money
                Laundering and Proceeds of Crime Act (Zimbabwe) · FATF Recommendations 2024.
              </div>
            </div>

            {/* CHECK EXISTING */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-xs text-gray-500 mb-1.5">
                Check if this customer is already registered
              </div>
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
                  className="h-9 px-4 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
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

            {/* ── MAIN FORM ───────────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">

              {/* ── IDENTITY VERIFICATION ─────────────────────────────────── */}
              <div>
                <SectionLabel>Identity verification</SectionLabel>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Full name <span className="text-gray-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: '' })); }}
                        className={fc('fullName')}
                        placeholder="e.g. Tatenda Moyo"
                      />
                      {errors.fullName && <div className="text-xs text-gray-500 mt-1">{errors.fullName}</div>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        National ID <span className="text-gray-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={nationalId}
                        onChange={e => { setNationalId(e.target.value); if (errors.nationalId) setErrors(p => ({ ...p, nationalId: '' })); }}
                        className={fc('nationalId')}
                        placeholder="e.g. 63-123456A78"
                      />
                      {errors.nationalId && <div className="text-xs text-gray-500 mt-1">{errors.nationalId}</div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                        className={`${inputBase} border-gray-200`}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Nationality</label>
                      <input
                        type="text"
                        value={nationality}
                        onChange={e => setNationality(e.target.value)}
                        className={`${inputBase} border-gray-200`}
                        placeholder="e.g. Zimbabwean"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* ── CONTACT DETAILS ───────────────────────────────────────── */}
              <div>
                <SectionLabel>Contact details</SectionLabel>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
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
                        Email <span className="text-gray-300">(optional)</span>
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
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* ── FINANCIAL INFORMATION ─────────────────────────────────── */}
              <div>
                <SectionLabel>Financial information</SectionLabel>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Occupation</label>
                      <input
                        type="text"
                        value={occupation}
                        onChange={e => setOccupation(e.target.value)}
                        className={`${inputBase} border-gray-200`}
                        placeholder="e.g. Gold dealer, Farmer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Employer / Business</label>
                      <input
                        type="text"
                        value={employer}
                        onChange={e => setEmployer(e.target.value)}
                        className={`${inputBase} border-gray-200`}
                        placeholder="e.g. Self-employed, Fidelity Gold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Source of funds</label>
                    <select
                      value={sourceOfFunds}
                      onChange={e => setSourceOfFunds(e.target.value)}
                      className={`${inputBase} border-gray-200`}
                    >
                      <option value="">Select source of funds...</option>
                      <option value="Salary">Salary</option>
                      <option value="Business income">Business income</option>
                      <option value="Inheritance">Inheritance</option>
                      <option value="Investment returns">Investment returns</option>
                      <option value="Gold mining proceeds">Gold mining proceeds</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="text-xs text-gray-400 mt-1">
                      Most important field — explains where the money came from
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Expected transaction frequency
                      </label>
                      <select
                        value={transactionFrequency}
                        onChange={e => setTransactionFrequency(e.target.value)}
                        className={`${inputBase} border-gray-200`}
                      >
                        <option value="">Select frequency...</option>
                        <option value="Once off">Once off</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Regular / ongoing">Regular / ongoing</option>
                      </select>
                      <div className="text-xs text-gray-400 mt-1">
                        Weekly buyers require enhanced monitoring
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* ── RISK ASSESSMENT ───────────────────────────────────────── */}
              <div>
                <SectionLabel>Risk assessment</SectionLabel>
                <div className="space-y-3">

                  {/* PEP */}
                  <div className="flex items-center justify-between py-3 border border-gray-100 rounded-lg px-4">
                    <div>
                      <div className="text-sm text-gray-800 font-medium">
                        Politically exposed person (PEP)?
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Government officials, politicians, senior public figures or their associates
                      </div>
                    </div>
                    <YesNoToggle value={politicallyExposed} onChange={setPoliticallyExposed} />
                  </div>
                  {politicallyExposed && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Describe their position</label>
                      <textarea
                        value={pepDetails}
                        onChange={e => { setPepDetails(e.target.value); if (errors.pepDetails) setErrors(p => ({ ...p, pepDetails: '' })); }}
                        className={`w-full border rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800 min-h-16 ${errors.pepDetails ? 'border-gray-800' : 'border-gray-200'}`}
                        placeholder="e.g. Member of Parliament for Harare West since 2018..."
                      />
                      {errors.pepDetails && <div className="text-xs text-gray-500 mt-1">{errors.pepDetails}</div>}
                    </div>
                  )}

                  {/* Sanctions */}
                  <div className="flex items-center justify-between py-3 border border-gray-100 rounded-lg px-4">
                    <div>
                      <div className="text-sm text-gray-800 font-medium">
                        Any known sanctions?
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        OFAC, UN, EU, or Zimbabwe sanctions list
                      </div>
                    </div>
                    <YesNoToggle value={knownSanctions} onChange={setKnownSanctions} />
                  </div>
                  {knownSanctions && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Describe the sanctions</label>
                      <textarea
                        value={sanctionsDetails}
                        onChange={e => { setSanctionsDetails(e.target.value); if (errors.sanctionsDetails) setErrors(p => ({ ...p, sanctionsDetails: '' })); }}
                        className={`w-full border rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800 min-h-16 ${errors.sanctionsDetails ? 'border-gray-800' : 'border-gray-200'}`}
                        placeholder="e.g. Listed on OFAC SDN list as of Jan 2024..."
                      />
                      {errors.sanctionsDetails && <div className="text-xs text-gray-500 mt-1">{errors.sanctionsDetails}</div>}
                    </div>
                  )}

                  {/* High-risk warning */}
                  {(politicallyExposed || knownSanctions) && (
                    <div className="bg-gray-900 text-white rounded-lg p-3">
                      <div className="text-xs leading-relaxed">
                        {knownSanctions
                          ? 'This customer has known sanctions. This transaction may be prohibited. Stop and report to your compliance officer immediately before proceeding.'
                          : 'Politically exposed persons require enhanced due diligence. This customer will be automatically flagged for compliance review. Obtain additional documentation and approval before proceeding.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                  {submitError}
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex gap-3 pt-1">
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
                  {isSubmitting ? 'Saving…' : 'Save customer record'}
                </button>
              </div>
            </div>

            {/* ── CDD FORM FOOTER ─────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 flex items-center justify-between">
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-gray-400">Recorded by</div>
                  <div className="text-xs text-gray-700 font-medium mt-0.5">
                    {minerName || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Date</div>
                  <div className="text-xs text-gray-700 font-medium mt-0.5">{today}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">CDD reference</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{cddRef}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
