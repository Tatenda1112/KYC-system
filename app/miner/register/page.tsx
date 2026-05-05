'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface ExistingRegistration {
  id: number;
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
}

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

export default function MinerKycUploadOnlyPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [registration, setRegistration] = useState<ExistingRegistration | null>(null);

  const [docs, setDocs] = useState<Record<'nationalId' | 'certificate' | 'proofOfAddress', DocState>>({
    nationalId: { file: null, fileName: '', fileSize: '', status: 'pending' },
    certificate: { file: null, fileName: '', fileSize: '', status: 'pending' },
    proofOfAddress: { file: null, fileName: '', fileSize: '', status: 'pending' },
  });

  const certRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const nationalIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadRegistration = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!meRes.ok) throw new Error('Failed to load user');
        const user = await meRes.json() as { miner_registration_id?: number };

        if (!user?.miner_registration_id) {
          throw new Error('No miner registration profile found for this account.');
        }

        const regRes = await fetch(
          `${BACKEND}/miners/registrations/${user.miner_registration_id}`,
          { cache: 'no-store' },
        );
        if (!regRes.ok) throw new Error('Failed to load existing registration profile.');
        const reg = await regRes.json() as ExistingRegistration;
        setRegistration(reg);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to load registration profile.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRegistration();
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
    if (!registration) return;
    setSubmitError('');
    setIsSubmitting(true);

    const storedUser = localStorage.getItem('user');
    const currentUser = storedUser ? JSON.parse(storedUser) as { email?: string } : null;

    const payload = new FormData();
    if (currentUser?.email) payload.append('account_email', currentUser.email);
    payload.append('full_name', registration.full_name);
    payload.append('national_id', registration.national_id);
    payload.append('district', registration.district);
    payload.append('years_of_operation', registration.years_of_operation);
    payload.append('education_level', registration.education_level);
    payload.append('registration_type', registration.registration_type);
    payload.append('mining_reg_number', registration.mining_reg_number);
    payload.append('owner_full_name', registration.owner_full_name);
    payload.append('owner_national_id', registration.owner_national_id);
    payload.append('owner_relationship', registration.owner_relationship);
    payload.append('owner_phone', registration.owner_phone);
    payload.append('owner_email', registration.owner_email ?? '');
    payload.append('owner_address', registration.owner_address);
    payload.append('declaration_confirmed', String(Boolean(registration.declaration_confirmed)));

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

      const registered = await res.json() as { reg_number: string; kyc_status?: string };
      localStorage.setItem('minerRegNumber', registered.reg_number);
      localStorage.setItem('minerName', registration.full_name ?? '');
      localStorage.setItem('minerKycStatus', registered.kyc_status ?? 'Pending');
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300 flex-shrink-0">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="text-xs text-gray-700 font-medium">{doc.fileName}</div>
              <div className="text-xs text-gray-400 mt-0.5">{doc.fileSize} - Uploaded</div>
            </div>
          </div>
          <button type="button" onClick={() => removeDoc(docKey)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300 mx-auto mb-2">
            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-xs text-gray-500">Click to upload or drag file here</div>
          <div className="text-xs text-gray-400 mt-1">PDF, JPG or PNG - max 5MB</div>
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
                <div className="text-gray-900 text-base font-medium mt-2">Documents submitted</div>
                <div className="text-gray-400 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
                  Your KYC documents are now under review. You will be notified once verification is complete.
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

  return (
    <div className="flex h-screen">
      <Sidebar role="miner" activePage="registerkyc" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center px-5">
          <div className="text-sm font-medium text-gray-800">KYC registration</div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-sm font-medium text-gray-900">Upload KYC documents</div>
                <div className="text-xs text-gray-400 mt-0.5">Only document upload is required on this page</div>
              </div>
              <div className="text-xs text-gray-300">Single step</div>
            </div>

            {isLoading ? (
              <div className="text-sm text-gray-400">Loading profile...</div>
            ) : (
              <>
                <div className="space-y-5">
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">National ID (front and back)</div>
                    <UploadArea docKey="nationalId" inputRef={nationalIdRef} />
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Mining registration certificate</div>
                    <UploadArea docKey="certificate" inputRef={certRef} />
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Proof of address (utility bill or bank statement)</div>
                    <UploadArea docKey="proofOfAddress" inputRef={addressRef} />
                  </div>
                </div>

                <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2 rounded-r mt-5">
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Your documents will be reviewed by a compliance officer. Only verified miners can use transaction and reporting features.
                  </div>
                </div>

                {submitError && (
                  <div className="mt-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => router.push('/miner/dashboard')}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !registration}
                    className="flex-[2] bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit KYC documents'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
