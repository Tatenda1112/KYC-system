'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface FormData {
  fullName: string;
  nationalId: string;
  district: string;
  yearsOfOperation: string;
  educationLevel: string;
  registrationType: string;
  miningRegistrationNumber: string;
}

interface FormErrors {
  [key: string]: string;
}

const PLACEHOLDER_VALUES = ['PENDING', 'Not provided', 'pending', 'not provided'];
const isPlaceholder = (v: string | null | undefined) =>
  !v || PLACEHOLDER_VALUES.includes(v.trim());

const inputBase =
  'h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800';
const readonlyBase =
  'h-9 w-full border border-gray-100 rounded-md bg-gray-50 px-3 text-sm text-gray-500 cursor-not-allowed select-none';

export default function MinerRegistrationStep1Page() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    nationalId: '',
    district: '',
    yearsOfOperation: '',
    educationLevel: '',
    registrationType: '',
    miningRegistrationNumber: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  // Fields locked because admin pre-filled them
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const [prefilled, setPrefilled] = useState(false);
  const router = useRouter();

  // Load pre-filled data from admin-created registration on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(async user => {
        if (!user?.miner_registration_id) return;

        const res = await fetch(
          `${BACKEND}/miners/registrations/${user.miner_registration_id}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const reg = await res.json();

        const locked = new Set<string>();
        const updates: Partial<FormData> = {};

        // full_name: always pre-filled and locked (admin set it)
        if (reg.full_name && !isPlaceholder(reg.full_name)) {
          updates.fullName = reg.full_name;
          locked.add('fullName');
        }

        // mining_reg_number: the unique identifier — always locked
        if (reg.mining_reg_number && !isPlaceholder(reg.mining_reg_number)) {
          updates.miningRegistrationNumber = reg.mining_reg_number;
          locked.add('miningRegistrationNumber');
        }

        // district: pre-filled but miner can correct if needed
        if (reg.district && !isPlaceholder(reg.district)) {
          updates.district = reg.district;
        }

        // registration_type: pre-filled but miner can correct if needed
        if (reg.registration_type && !isPlaceholder(reg.registration_type)) {
          updates.registrationType = reg.registration_type;
        }

        // national_id, years_of_operation, education_level: admin left placeholders — miner fills these
        if (!isPlaceholder(reg.national_id)) updates.nationalId = reg.national_id;
        if (!isPlaceholder(reg.years_of_operation)) updates.yearsOfOperation = reg.years_of_operation;
        if (!isPlaceholder(reg.education_level)) updates.educationLevel = reg.education_level;

        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
          setLockedFields(locked);
          setPrefilled(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (field: keyof FormData, value: string) => {
    if (lockedFields.has(field)) return;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.fullName.trim()) e.fullName = 'This field is required';
    if (!formData.nationalId.trim()) e.nationalId = 'This field is required';
    if (!formData.district) e.district = 'This field is required';
    if (!formData.yearsOfOperation) e.yearsOfOperation = 'This field is required';
    if (!formData.educationLevel) e.educationLevel = 'This field is required';
    if (!formData.registrationType) e.registrationType = 'This field is required';
    if (!formData.miningRegistrationNumber.trim())
      e.miningRegistrationNumber = 'This field is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    sessionStorage.setItem('minerRegistrationStep1', JSON.stringify(formData));
    router.push('/miner/register/step2');
  };

  const handleSaveDraft = () => {
    sessionStorage.setItem('minerRegistrationDraft1', JSON.stringify(formData));
  };

  const fieldClass = (field: string) =>
    lockedFields.has(field)
      ? readonlyBase
      : `${inputBase} ${errors[field] ? 'border-gray-800' : 'border-gray-200'}`;

  const selectClass = (field: string) =>
    lockedFields.has(field)
      ? `h-9 w-full border border-gray-100 rounded-md bg-gray-50 px-2 text-sm text-gray-500 cursor-not-allowed`
      : `h-9 w-full border rounded-md bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
          errors[field] ? 'border-gray-800' : 'border-gray-200'
        }`;

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="registerkyc" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOPBAR */}
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">KYC registration</div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">

            {/* CARD HEADER */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Step 1 of 3 — Personal details
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Basic information and mining registration
                </div>
              </div>
              <div className="text-xs text-gray-300">33% complete</div>
            </div>

            {/* STEP PROGRESS */}
            <div className="flex items-start gap-0 mb-8">
              {/* Step 1 — ACTIVE */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white ring-2 ring-gray-200 ring-offset-2 flex items-center justify-center text-xs">
                  1
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Details</div>
              </div>
              <div className="flex-1 h-px bg-gray-200 mt-3" />
              {/* Step 2 — TODO */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-xs">
                  2
                </div>
                <div className="text-xs text-gray-400 text-center mt-1">Ownership</div>
              </div>
              <div className="flex-1 h-px bg-gray-200 mt-3" />
              {/* Step 3 — TODO */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-xs">
                  3
                </div>
                <div className="text-xs text-gray-400 text-center mt-1">Documents</div>
              </div>
            </div>

            {/* FORM */}
            <div className="space-y-4">

              {prefilled && (
                <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2.5 rounded-r">
                  <div className="text-xs font-medium text-gray-600 mb-0.5">Some fields pre-filled by admin</div>
                  <div className="text-xs text-gray-400 leading-relaxed">
                    Greyed fields were set when your account was created and cannot be changed. Complete the remaining fields below.
                  </div>
                </div>
              )}

              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Full name
                    {lockedFields.has('fullName') && <span className="ml-1 text-gray-300">(pre-filled)</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={e => handleChange('fullName', e.target.value)}
                    readOnly={lockedFields.has('fullName')}
                    className={fieldClass('fullName')}
                    placeholder="Enter full name"
                  />
                  {errors.fullName && (
                    <div className="text-xs text-gray-500 mt-1">{errors.fullName}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">National ID number</label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={e => handleChange('nationalId', e.target.value)}
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
                  <label className="text-xs text-gray-500 mb-1 block">District of operation</label>
                  <select
                    value={formData.district}
                    onChange={e => handleChange('district', e.target.value)}
                    disabled={lockedFields.has('district')}
                    className={selectClass('district')}
                  >
                    <option value="">Select district...</option>
                    <option value="Kadoma">Kadoma</option>
                    <option value="Ngezi">Ngezi</option>
                    <option value="Shurugwi">Shurugwi</option>
                    <option value="Zvishavane">Zvishavane</option>
                    <option value="Gwanda">Gwanda</option>
                  </select>
                  {errors.district && (
                    <div className="text-xs text-gray-500 mt-1">{errors.district}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Years of operation</label>
                  <select
                    value={formData.yearsOfOperation}
                    onChange={e => handleChange('yearsOfOperation', e.target.value)}
                    className={selectClass('yearsOfOperation')}
                  >
                    <option value="">Select...</option>
                    <option value="1-2">1 to 2 years</option>
                    <option value="3-5">3 to 5 years</option>
                    <option value="6-10">6 to 10 years</option>
                    <option value="10+">Above 10 years</option>
                  </select>
                  {errors.yearsOfOperation && (
                    <div className="text-xs text-gray-500 mt-1">{errors.yearsOfOperation}</div>
                  )}
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Education level</label>
                  <select
                    value={formData.educationLevel}
                    onChange={e => handleChange('educationLevel', e.target.value)}
                    className={selectClass('educationLevel')}
                  >
                    <option value="">Select...</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Diploma">Diploma or Certificate</option>
                    <option value="Degree">Degree and above</option>
                  </select>
                  {errors.educationLevel && (
                    <div className="text-xs text-gray-500 mt-1">{errors.educationLevel}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Registration type</label>
                  <select
                    value={formData.registrationType}
                    onChange={e => handleChange('registrationType', e.target.value)}
                    disabled={lockedFields.has('registrationType')}
                    className={selectClass('registrationType')}
                  >
                    <option value="">Select...</option>
                    <option value="Cooperative">Cooperative</option>
                    <option value="Individual Licence">Individual Licence</option>
                    <option value="Company">Company</option>
                    <option value="Syndicate">Syndicate</option>
                  </select>
                  {errors.registrationType && (
                    <div className="text-xs text-gray-500 mt-1">{errors.registrationType}</div>
                  )}
                </div>
              </div>

              {/* Full width */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Mining registration number
                  {lockedFields.has('miningRegistrationNumber') && <span className="ml-1 text-gray-300">(pre-filled)</span>}
                </label>
                <input
                  type="text"
                  value={formData.miningRegistrationNumber}
                  onChange={e => handleChange('miningRegistrationNumber', e.target.value)}
                  readOnly={lockedFields.has('miningRegistrationNumber')}
                  className={fieldClass('miningRegistrationNumber')}
                  placeholder="e.g. COOP-SHU-2021-0042"
                />
                {errors.miningRegistrationNumber && (
                  <div className="text-xs text-gray-500 mt-1">
                    {errors.miningRegistrationNumber}
                  </div>
                )}
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-[2] bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
                >
                  Next — beneficial owner
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
