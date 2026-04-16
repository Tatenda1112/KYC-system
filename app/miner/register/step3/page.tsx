'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface DocState {
  file: File | null;
  fileName: string;
  fileSize: string;
  status: 'uploaded' | 'pending';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MinerRegistrationStep3Page() {
  const [docs, setDocs] = useState<Record<'nationalId' | 'certificate' | 'proofOfAddress', DocState>>({
    nationalId: {
      file: null,
      fileName: '',
      fileSize: '',
      status: 'pending' as const,
    },
    certificate: { file: null, fileName: '', fileSize: '', status: 'pending' as const },
    proofOfAddress: { file: null, fileName: '', fileSize: '', status: 'pending' as const },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [registrationData, setRegistrationData] = useState<Record<string, unknown> | null>(null);

  const certRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const nationalIdRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useEffect(() => {
    const saved = sessionStorage.getItem('minerRegistrationStep2');
    if (saved) {
      setRegistrationData(JSON.parse(saved));
    } else {
      router.push('/miner/register');
    }
  }, [router]);

  const handleFileChange = (
    key: 'nationalId' | 'certificate' | 'proofOfAddress',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocs(prev => ({
      ...prev,
      [key]: { file, fileName: file.name, fileSize: formatSize(file.size), status: 'uploaded' },
    }));
  };

  const removeDoc = (key: 'nationalId' | 'certificate' | 'proofOfAddress') => {
    setDocs(prev => ({
      ...prev,
      [key]: { file: null, fileName: '', fileSize: '', status: 'pending' },
    }));
  };

  const handleSubmit = async () => {
    if (!registrationData) return;
    setSubmitError('');
    setIsSubmitting(true);

    const step1 = registrationData.step1 as Record<string, string>;
    const step2 = registrationData.step2 as Record<string, unknown>;
    const storedUser =
      typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const currentUser = storedUser ? JSON.parse(storedUser) as { email?: string } : null;

    const payload = new FormData();
    if (currentUser?.email) {
      payload.append('account_email', currentUser.email);
    }
    payload.append('full_name', step1.fullName);
    payload.append('national_id', step1.nationalId);
    payload.append('district', step1.district);
    payload.append('years_of_operation', step1.yearsOfOperation);
    payload.append('education_level', step1.educationLevel);
    payload.append('registration_type', step1.registrationType);
    payload.append('mining_reg_number', step1.miningRegistrationNumber);
    payload.append('owner_full_name', String(step2.beneficialOwnerFullName ?? ''));
    payload.append('owner_national_id', String(step2.beneficialOwnerNationalId ?? ''));
    payload.append('owner_relationship', String(step2.relationshipToOperation ?? ''));
    payload.append('owner_phone', String(step2.ownerPhoneNumber ?? ''));
    payload.append('owner_email', String(step2.ownerEmail ?? ''));
    payload.append('owner_address', String(step2.physicalAddress ?? ''));
    payload.append('declaration_confirmed', String(Boolean(step2.declarationConfirmed)));

    if (docs.nationalId.file) payload.append('national_id_file', docs.nationalId.file);
    if (docs.certificate.file) payload.append('registration_cert_file', docs.certificate.file);
    if (docs.proofOfAddress.file) payload.append('proof_of_address_file', docs.proofOfAddress.file);

    try {
      const res = await fetch(`${BACKEND}/miners/register`, {
        method: 'POST',
        body: payload,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Submission failed');
      }

      // Persist miner identity so transaction pages can link records
      const registered = await res.json() as { reg_number: string; kyc_status?: string };
      localStorage.setItem('minerRegNumber', registered.reg_number);
      localStorage.setItem('minerName', step1.fullName ?? '');
      localStorage.setItem('minerKycStatus', registered.kyc_status ?? 'Pending');

      sessionStorage.removeItem('minerRegistrationStep1');
      sessionStorage.removeItem('minerRegistrationStep2');
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!registrationData) {
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

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="flex h-screen">
        <Sidebar role="miner" activePage="registerkyc" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
            <div className="text-sm font-medium text-gray-800">KYC registration</div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 p-5">
            <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-center py-8">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-12 h-12 mx-auto text-gray-800"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l3 3 5-5" />
                </svg>
                <div className="text-gray-900 text-base font-medium mt-5">
                  Registration submitted
                </div>
                <div className="text-gray-400 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
                  Your KYC application is under review. A compliance officer will verify your
                  documents. You will be notified once approved.
                </div>
                <button
                  onClick={() => router.push('/miner/dashboard')}
                  className="block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition mt-8 w-full max-w-xs mx-auto"
                >
                  Go to my dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOAD AREA helper ────────────────────────────────────────────────────
  const UploadArea = ({
    docKey,
    inputRef,
  }: {
    docKey: 'nationalId' | 'certificate' | 'proofOfAddress';
    inputRef: React.RefObject<HTMLInputElement | null>;
  }) => {
    const doc = docs[docKey];

    if (doc.status === 'uploaded') {
      return (
        <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-8 h-8 text-gray-300 flex-shrink-0"
            >
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="text-xs text-gray-700 font-medium">{doc.fileName}</div>
              <div className="text-xs text-gray-400 mt-0.5">{doc.fileSize} · Uploaded</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeDoc(docKey)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Remove
          </button>
        </div>
      );
    }

    return (
      <>
        <div
          onClick={() => inputRef.current?.click()}
          className="border border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-8 h-8 text-gray-300 mx-auto mb-2"
          >
            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-xs text-gray-500">Click to upload or drag file here</div>
          <div className="text-xs text-gray-400 mt-1">PDF, JPG or PNG · max 5MB</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => handleFileChange(docKey, e)}
        />
      </>
    );
  };

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
                  Step 3 of 3 — Upload documents
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Upload clear photos or scans of required documents
                </div>
              </div>
              <div className="text-xs text-gray-300">Almost done</div>
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
              {/* Step 2 — DONE */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">
                  2
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Ownership</div>
              </div>
              <div className="flex-1 h-px bg-gray-700 mt-3" />
              {/* Step 3 — ACTIVE */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white ring-2 ring-gray-200 ring-offset-2 flex items-center justify-center text-xs">
                  3
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Documents</div>
              </div>
            </div>

            {/* DOCUMENT SECTIONS */}
            <div className="space-y-5">

              {/* Doc 1 — National ID */}
              <div>
                <div className="text-xs text-gray-500 mb-1.5">National ID (front and back)</div>
                <UploadArea docKey="nationalId" inputRef={nationalIdRef} />
              </div>

              {/* Doc 2 — Registration certificate */}
              <div>
                <div className="text-xs text-gray-500 mb-1.5">
                  Mining registration certificate
                </div>
                <UploadArea docKey="certificate" inputRef={certRef} />
              </div>

              {/* Doc 3 — Proof of address */}
              <div>
                <div className="text-xs text-gray-500 mb-1.5">
                  Proof of address (utility bill or bank statement)
                </div>
                <UploadArea docKey="proofOfAddress" inputRef={addressRef} />
              </div>
            </div>

            {/* NOTE BOX */}
            <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2 rounded-r mt-5">
              <div className="text-xs text-gray-500 leading-relaxed">
                Your documents will be reviewed by a compliance officer. Only verified miners
                can use transaction and reporting features.
              </div>
            </div>

            {submitError && (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                {submitError}
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => router.push('/miner/register/step2')}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-[2] bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting…' : 'Submit KYC registration'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
