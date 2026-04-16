'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';

interface FormData {
  beneficialOwnerFullName: string;
  beneficialOwnerNationalId: string;
  relationshipToOperation: string;
  ownerPhoneNumber: string;
  ownerEmail: string;
  physicalAddress: string;
  declarationConfirmed: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const inputBase =
  'h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800';

export default function MinerRegistrationStep2Page() {
  const [formData, setFormData] = useState<FormData>({
    beneficialOwnerFullName: '',
    beneficialOwnerNationalId: '',
    relationshipToOperation: '',
    ownerPhoneNumber: '',
    ownerEmail: '',
    physicalAddress: '',
    declarationConfirmed: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [step1Data, setStep1Data] = useState<Record<string, string> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const saved = sessionStorage.getItem('minerRegistrationStep1');
    if (saved) {
      setStep1Data(JSON.parse(saved));
    } else {
      router.push('/miner/register');
    }
  }, [router]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.beneficialOwnerFullName.trim())
      e.beneficialOwnerFullName = 'This field is required';
    if (!formData.beneficialOwnerNationalId.trim())
      e.beneficialOwnerNationalId = 'This field is required';
    if (!formData.relationshipToOperation)
      e.relationshipToOperation = 'This field is required';
    if (!formData.ownerPhoneNumber.trim())
      e.ownerPhoneNumber = 'This field is required';
    if (!formData.physicalAddress.trim())
      e.physicalAddress = 'This field is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    sessionStorage.setItem(
      'minerRegistrationStep2',
      JSON.stringify({ step1: step1Data, step2: formData }),
    );
    router.push('/miner/register/step3');
  };

  const fieldClass = (field: string) =>
    `${inputBase} ${errors[field] ? 'border-gray-800' : 'border-gray-200'}`;

  const selectClass = (field: string) =>
    `h-9 w-full border rounded-md bg-gray-50 px-2 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
      errors[field] ? 'border-gray-800' : 'border-gray-200'
    }`;

  if (!step1Data) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="registerkyc" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">KYC registration</div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-gray-400">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

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
                  Step 2 of 3 — Beneficial owner
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Identify who controls or benefits from this operation
                </div>
              </div>
              <div className="text-xs text-gray-300">66% complete</div>
            </div>

            {/* STEP PROGRESS */}
            <div className="flex items-start gap-0 mb-8">
              {/* Step 1 — DONE */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">
                  1
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Details</div>
              </div>
              <div className="flex-1 h-px bg-gray-700 mt-3" />
              {/* Step 2 — ACTIVE */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white ring-2 ring-gray-200 ring-offset-2 flex items-center justify-center text-xs">
                  2
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Ownership</div>
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

            {/* INFO BOX */}
            <div className="border-l-2 border-gray-400 bg-gray-50 pl-4 py-3 rounded-r mb-5">
              <div className="text-xs font-medium text-gray-600 mb-1">Why is this required?</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                FATF (2024) identifies beneficial ownership verification as the single greatest
                compliance gap in high-risk commodity sectors globally. Under the Risk-Based
                Approach, beneficial ownership verification is a mandatory obligation for all gold
                sector transactions — not a discretionary best practice.
                (Chidzedzere, 2025, p. 12)
              </div>
            </div>

            {/* FORM */}
            <div className="space-y-4">

              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Beneficial owner full name
                  </label>
                  <input
                    type="text"
                    value={formData.beneficialOwnerFullName}
                    onChange={e => handleChange('beneficialOwnerFullName', e.target.value)}
                    className={fieldClass('beneficialOwnerFullName')}
                    placeholder="Enter full name"
                  />
                  {errors.beneficialOwnerFullName && (
                    <div className="text-xs text-gray-500 mt-1">
                      {errors.beneficialOwnerFullName}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Owner national ID number
                  </label>
                  <input
                    type="text"
                    value={formData.beneficialOwnerNationalId}
                    onChange={e => handleChange('beneficialOwnerNationalId', e.target.value)}
                    className={fieldClass('beneficialOwnerNationalId')}
                    placeholder="e.g. 63-987654B21"
                  />
                  {errors.beneficialOwnerNationalId && (
                    <div className="text-xs text-gray-500 mt-1">
                      {errors.beneficialOwnerNationalId}
                    </div>
                  )}
                </div>
              </div>

              {/* Full width */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Relationship to operation
                </label>
                <select
                  value={formData.relationshipToOperation}
                  onChange={e => handleChange('relationshipToOperation', e.target.value)}
                  className={selectClass('relationshipToOperation')}
                >
                  <option value="">Select relationship...</option>
                  <option value="sole-operator">Sole operator and owner</option>
                  <option value="business-partner">Business partner</option>
                  <option value="company-director">Company director</option>
                  <option value="cooperative-chairperson">Cooperative chairperson</option>
                  <option value="other">Other</option>
                </select>
                {errors.relationshipToOperation && (
                  <div className="text-xs text-gray-500 mt-1">
                    {errors.relationshipToOperation}
                  </div>
                )}
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Owner phone number</label>
                  <input
                    type="text"
                    value={formData.ownerPhoneNumber}
                    onChange={e => handleChange('ownerPhoneNumber', e.target.value)}
                    className={fieldClass('ownerPhoneNumber')}
                    placeholder="e.g. +263 77 123 4567"
                  />
                  {errors.ownerPhoneNumber && (
                    <div className="text-xs text-gray-500 mt-1">{errors.ownerPhoneNumber}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Owner email (optional)
                  </label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={e => handleChange('ownerEmail', e.target.value)}
                    className={`${inputBase} border-gray-200`}
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              {/* Full width */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Physical address</label>
                <input
                  type="text"
                  value={formData.physicalAddress}
                  onChange={e => handleChange('physicalAddress', e.target.value)}
                  className={fieldClass('physicalAddress')}
                  placeholder="e.g. 12 Mine Road, Shurugwi, Midlands"
                />
                {errors.physicalAddress && (
                  <div className="text-xs text-gray-500 mt-1">{errors.physicalAddress}</div>
                )}
              </div>

              {/* DECLARATION BOX */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
                <div className="text-xs text-gray-500 leading-relaxed">
                  Declaration: I confirm that the beneficial owner information provided above is
                  accurate and complete. I understand that providing false information constitutes
                  a violation of the Money Laundering and Proceeds of Crime Act (Chapter 9:24)
                  of Zimbabwe.
                </div>
                <div className="flex items-start gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="declaration"
                    checked={formData.declarationConfirmed}
                    onChange={e => handleChange('declarationConfirmed', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-gray-800 mt-0.5"
                  />
                  <label htmlFor="declaration" className="text-xs text-gray-600 cursor-pointer">
                    I confirm this declaration is true and accurate
                  </label>
                </div>
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/miner/register')}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!formData.declarationConfirmed}
                  className="flex-[2] bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next — upload documents
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
