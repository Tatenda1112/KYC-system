'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

type PaymentMethod = 'cash' | 'bank' | 'mobile';

interface SelectedCustomer {
  id: number;
  full_name: string;
  national_id: string;
  risk_level: string;
  is_flagged: boolean;
}

interface FormData {
  transactionDate: string;
  goldWeightGrams: string;
  saleAmountUsd: string;
  buyingCentre: string;
  buyerName: string;
}

interface FormErrors {
  [key: string]: string;
}

const inputBase =
  'h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800';

const RISK_BADGE: Record<string, string> = {
  high: 'bg-gray-900 text-white',
  medium: 'bg-gray-200 text-gray-700',
  low: 'bg-gray-100 text-gray-500',
};

export default function RecordGoldSalePage() {
  const [formData, setFormData] = useState<FormData>({
    transactionDate: '',
    goldWeightGrams: '',
    saleAmountUsd: '',
    buyingCentre: '',
    buyerName: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [buyerVerified, setBuyerVerified] = useState(true);
  const [cddCompleted, setCddCompleted] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [minerKycStatus, setMinerKycStatus] = useState('');
  const [minerRegNumber, setMinerRegNumber] = useState<string | null>(null);

  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerCheckInput, setCustomerCheckInput] = useState('');
  const [customerCheckLoading, setCustomerCheckLoading] = useState(false);
  const [customerCheckDone, setCustomerCheckDone] = useState(false);
  const [customerCheckResult, setCustomerCheckResult] = useState<SelectedCustomer | null>(null);

  const router = useRouter();

  useEffect(() => {
    setMinerKycStatus(localStorage.getItem('minerKycStatus') ?? '');
    const reg = localStorage.getItem('minerRegNumber');
    setMinerRegNumber(reg);

    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
          if (user?.miner_reg_number) {
            setMinerRegNumber(user.miner_reg_number);
            localStorage.setItem('minerRegNumber', user.miner_reg_number);
          }
          if (user?.full_name) {
            localStorage.setItem('minerName', user.full_name);
          }
          if (user?.miner_kyc_status) {
            setMinerKycStatus(user.miner_kyc_status);
            localStorage.setItem('minerKycStatus', user.miner_kyc_status);
          } else {
            setMinerKycStatus('');
            localStorage.removeItem('minerKycStatus');
          }
        })
        .catch(() => {});
    }

    // Read pre-selected customer from URL query params
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('customer_id');
    const cName = params.get('customer_name');
    const cNatId = params.get('customer_national_id');
    const cRisk = params.get('customer_risk');
    const cFlagged = params.get('customer_flagged');
    if (cId && cName) {
      setSelectedCustomer({
        id: parseInt(cId),
        full_name: cName,
        national_id: cNatId ?? '',
        risk_level: cRisk ?? 'medium',
        is_flagged: cFlagged === 'true',
      });
    }
  }, []);

  const handleCustomerCheck = async () => {
    if (!customerCheckInput.trim()) return;
    setCustomerCheckLoading(true);
    setCustomerCheckDone(false);
    setCustomerCheckResult(null);
    try {
      const p = new URLSearchParams({ national_id: customerCheckInput.trim() });
      const reg = localStorage.getItem('minerRegNumber');
      if (reg) p.set('miner_reg_number', reg);
      const res = await fetch(`/api/customers/check?${p}`, { cache: 'no-store' });
      const data = await res.json();
      setCustomerCheckResult(data ?? null);
      setCustomerCheckDone(true);
    } catch {
      setCustomerCheckDone(true);
    } finally {
      setCustomerCheckLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!selectedCustomer) e.customer = 'Select or add a customer before submitting';
    if (!formData.transactionDate) e.transactionDate = 'This field is required';
    if (!formData.goldWeightGrams || parseFloat(formData.goldWeightGrams) <= 0)
      e.goldWeightGrams = 'This field is required';
    if (!formData.saleAmountUsd || parseFloat(formData.saleAmountUsd) <= 0)
      e.saleAmountUsd = 'This field is required';
    if (!formData.buyingCentre.trim()) e.buyingCentre = 'This field is required';
    if (!formData.buyerName.trim()) e.buyerName = 'This field is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitError('');
    setIsSubmitting(true);

    const minerReg =
      typeof window !== 'undefined' ? localStorage.getItem('minerRegNumber') : null;

    const payload = {
      transaction_date: formData.transactionDate,
      gold_weight_grams: parseFloat(formData.goldWeightGrams),
      sale_amount_usd: parseFloat(formData.saleAmountUsd),
      buying_centre: formData.buyingCentre,
      buyer_name: formData.buyerName,
      payment_method: paymentMethod,
      buyer_verified: buyerVerified,
      cdd_completed: cddCompleted,
      miner_reg_number: minerReg ?? null,
      customer_id: selectedCustomer?.id ?? null,
      customer_name: selectedCustomer?.full_name ?? null,
      customer_id_verified: buyerVerified,
      customer_id_number: selectedCustomer?.national_id ?? null,
    };

    try {
      const res = await fetch(`${BACKEND}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Submission failed');
      }

      router.push('/miner/dashboard?transaction=success');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to record transaction. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (field: string) =>
    `${inputBase} ${errors[field] ? 'border-gray-800' : 'border-gray-200'}`;

  const paymentOptions: { label: string; value: PaymentMethod }[] = [
    { label: 'Cash', value: 'cash' },
    { label: 'Bank transfer', value: 'bank' },
    { label: 'Mobile money', value: 'mobile' },
  ];

  if (minerKycStatus && minerKycStatus !== 'Verified') {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="recordsale" kycStatus={minerKycStatus || undefined} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">Record new sale</div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-sm">
              <div className="text-sm font-medium text-gray-800 mb-2">Entry locked</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Your KYC status is {minerKycStatus}. You can record transactions after an administrator verifies your registration.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  const NoteCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-gray-50 rounded-lg p-3 mb-3">
      <div className="text-xs font-medium text-gray-600 mb-1.5">{title}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{children}</div>
    </div>
  );

  const WarningCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border-l-2 border-gray-400 bg-gray-50 pl-3 py-2.5 rounded-r mb-3">
      <div className="text-xs font-medium text-gray-600 mb-1">{title}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{children}</div>
    </div>
  );

  const showCashWarning = paymentMethod === 'cash';
  const showCddWarning = !buyerVerified || !cddCompleted;

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="recordsale" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">Record gold sale</div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="max-w-3xl mx-auto grid grid-cols-[1fr_260px] gap-4">

            {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* CARD 0 — Customer selection */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  Customer details
                </div>

                {selectedCustomer ? (
                  /* Customer selected — show summary */
                  <>
                    <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-900 font-medium">
                          {selectedCustomer.full_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {selectedCustomer.national_id} · {selectedCustomer.risk_level} risk
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${RISK_BADGE[selectedCustomer.risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                          {selectedCustomer.risk_level}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {selectedCustomer.is_flagged && (
                      <div className="bg-gray-900 text-white rounded-lg p-3 mt-2">
                        <div className="text-xs leading-relaxed">
                          This customer has compliance flags. Apply enhanced due diligence and
                          report to your compliance officer before proceeding with this transaction.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* No customer selected — show search */
                  <>
                    <label className="text-xs text-gray-500 mb-1.5 block">
                      Who is buying this gold?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customerCheckInput}
                        onChange={e => { setCustomerCheckInput(e.target.value); setCustomerCheckDone(false); }}
                        onKeyDown={e => e.key === 'Enter' && handleCustomerCheck()}
                        placeholder="Enter customer national ID to search..."
                        className={`${inputBase} flex-1 ${errors.customer ? 'border-gray-800' : 'border-gray-200'}`}
                      />
                      <button
                        type="button"
                        onClick={handleCustomerCheck}
                        disabled={customerCheckLoading || !customerCheckInput.trim()}
                        className="h-9 px-4 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                      >
                        {customerCheckLoading ? '…' : 'Search'}
                      </button>
                    </div>

                    {customerCheckDone && customerCheckResult && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-gray-700 font-medium">
                            {customerCheckResult.full_name}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {customerCheckResult.national_id} · {customerCheckResult.risk_level} risk
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedCustomer(customerCheckResult); if (errors.customer) setErrors(p => ({ ...p, customer: '' })); }}
                          className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded hover:bg-gray-800 transition"
                        >
                          Select
                        </button>
                      </div>
                    )}

                    {customerCheckDone && !customerCheckResult && (
                      <div className="text-xs text-gray-400 mt-2">
                        Customer not found.{' '}
                        <button
                          type="button"
                          onClick={() => router.push('/miner/customers/new')}
                          className="underline hover:text-gray-600"
                        >
                          Add new customer
                        </button>
                      </div>
                    )}

                    {!customerCheckDone && (
                      <div className="text-xs text-gray-400 mt-2">
                        Or{' '}
                        <button
                          type="button"
                          onClick={() => router.push('/miner/customers/new')}
                          className="underline hover:text-gray-600"
                        >
                          add a new customer
                        </button>
                      </div>
                    )}

                    {errors.customer && (
                      <div className="text-xs text-gray-500 mt-1">{errors.customer}</div>
                    )}
                  </>
                )}
              </div>

              {/* CARD 1 — Transaction details */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  Transaction details
                </div>

                <div className="space-y-4">
                  {/* Row 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Transaction date
                      </label>
                      <input
                        type="date"
                        value={formData.transactionDate}
                        onChange={e => handleChange('transactionDate', e.target.value)}
                        className={fieldClass('transactionDate')}
                      />
                      {errors.transactionDate && (
                        <div className="text-xs text-gray-500 mt-1">{errors.transactionDate}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Gold weight (grams)
                      </label>
                      <input
                        type="number"
                        value={formData.goldWeightGrams}
                        onChange={e => handleChange('goldWeightGrams', e.target.value)}
                        className={fieldClass('goldWeightGrams')}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      {formData.goldWeightGrams && parseFloat(formData.goldWeightGrams) > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          = {(parseFloat(formData.goldWeightGrams) / 1000).toFixed(3)} kg
                        </div>
                      )}
                      {errors.goldWeightGrams && (
                        <div className="text-xs text-gray-500 mt-1">{errors.goldWeightGrams}</div>
                      )}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Sale amount (USD)
                      </label>
                      <input
                        type="number"
                        value={formData.saleAmountUsd}
                        onChange={e => handleChange('saleAmountUsd', e.target.value)}
                        className={fieldClass('saleAmountUsd')}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      {errors.saleAmountUsd && (
                        <div className="text-xs text-gray-500 mt-1">{errors.saleAmountUsd}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Buying centre / location
                      </label>
                      <input
                        type="text"
                        value={formData.buyingCentre}
                        onChange={e => handleChange('buyingCentre', e.target.value)}
                        className={fieldClass('buyingCentre')}
                        placeholder="e.g. Shurugwi Fidelity"
                      />
                      {errors.buyingCentre && (
                        <div className="text-xs text-gray-500 mt-1">{errors.buyingCentre}</div>
                      )}
                    </div>
                  </div>

                  {/* Full width */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Buyer or agent name
                    </label>
                    <input
                      type="text"
                      value={formData.buyerName}
                      onChange={e => handleChange('buyerName', e.target.value)}
                      className={fieldClass('buyerName')}
                      placeholder="e.g. Fidelity Gold Refinery — Agent 004"
                    />
                    {errors.buyerName && (
                      <div className="text-xs text-gray-500 mt-1">{errors.buyerName}</div>
                    )}
                  </div>

                  {/* Payment method toggles */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Payment method</label>
                    <div className="flex gap-2">
                      {paymentOptions.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentMethod(opt.value)}
                          className={`flex-1 h-9 text-xs rounded-md border cursor-pointer transition flex items-center justify-center ${
                            paymentMethod === opt.value
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2 — CDD checks */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-4">
                  CDD compliance checks
                </div>

                {/* Row 1 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <div className="text-sm text-gray-800 font-medium">
                      Buyer identity verified
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Buyer ID checked before transaction
                    </div>
                  </div>
                  <CddToggle value={buyerVerified} onChange={setBuyerVerified} />
                </div>

                {/* Row 2 */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm text-gray-800 font-medium">
                      CDD procedure completed
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      All due diligence steps followed
                    </div>
                  </div>
                  <CddToggle value={cddCompleted} onChange={setCddCompleted} />
                </div>

                {submitError && (
                  <div className="mt-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                    {submitError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="mt-5 w-full bg-gray-900 text-white text-sm py-2.5 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit transaction record'}
                </button>
              </div>
            </div>

            {/* ── RIGHT COLUMN — Compliance notes ──────────────────────────── */}
            <div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">
                  Compliance notes
                </div>

                {/* Dynamic: cash warning */}
                {showCashWarning && (
                  <WarningCard title="Cash transaction rule">
                    Cash transactions above USD 500 are automatically flagged for compliance
                    review under AML regulations.
                  </WarningCard>
                )}

                {/* Dynamic: CDD incomplete */}
                {showCddWarning && (
                  <WarningCard title="CDD incomplete">
                    Transactions without completed CDD will be flagged and will reduce your
                    compliance score.
                  </WarningCard>
                )}

                {/* Static: compliance score */}
                <NoteCard title="Your compliance score">
                  Current: 54/100 · Medium risk
                  <br />
                  Completing CDD on every transaction improves your score over time.
                </NoteCard>

                {/* Static: formal banking */}
                <NoteCard title="Formal banking">
                  Using bank transfer or mobile money instead of cash counts toward your formal
                  banking compliance score.
                </NoteCard>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
