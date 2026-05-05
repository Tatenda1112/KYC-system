'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../components/Sidebar';

const BACKEND = 'http://localhost:8000';

interface FormData {
  fullName: string;
  email: string;
  role: 'miner' | 'compliance_officer' | '';
  district: string;
  registrationNumber: string;
  registrationType: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  role?: string;
  district?: string;
  registrationNumber?: string;
  registrationType?: string;
}

function formatApiError(errorData: unknown): string {
  if (!errorData || typeof errorData !== 'object') {
    return 'Failed to create user';
  }

  const data = errorData as {
    detail?: unknown;
    error?: unknown;
  };

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    const messages = data.detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const entry = item as { loc?: unknown; msg?: unknown };
        const msg = typeof entry.msg === 'string' ? entry.msg : null;
        const loc = Array.isArray(entry.loc)
          ? entry.loc.filter((part): part is string => typeof part === 'string').join(' -> ')
          : null;
        if (!msg) return null;
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  return 'Failed to create user';
}

export default function CreateUserPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    role: '',
    district: '',
    registrationNumber: '',
    registrationType: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdUserData, setCreatedUserData] = useState<{
    fullName: string;
    email: string;
    tempPassword: string;
    userId: string;
    role: string;
    minerRegistrationId?: number | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState('');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    if ((formData.role === 'miner' || formData.role === 'compliance_officer') && !formData.district) {
      newErrors.district = 'District is required for this role';
    }

    if (formData.role === 'miner' && !formData.registrationNumber.trim()) {
      newErrors.registrationNumber = 'Registration number is required for miners';
    }

    if (formData.role === 'miner' && !formData.registrationType) {
      newErrors.registrationType = 'Registration type is required for miners';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT ===');
    console.log('Form data:', formData);
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const payload = {
        full_name: formData.fullName,
        email: formData.email,
        role: formData.role,
        district: formData.district || null,
        registration_number: formData.registrationNumber || null,
        registration_type: formData.registrationType || null,
      };

      console.log('Sending payload:', payload);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(`${BACKEND}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        let message = 'Failed to create user';
        try {
          const errorData = await response.json();
          console.log('Error response:', errorData);
          message = formatApiError(errorData);
        } catch {}

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        throw new Error(message);
      }

      const result = await response.json();
      console.log('Success response:', result);
      setCreatedUserData({
        fullName: result.full_name,
        email: result.email,
        tempPassword: result.temp_password,
        userId: String(result.id),
        role: result.role,
        minerRegistrationId: result.miner_registration_id ?? null,
      });
      setSuccess(true);
    } catch (error) {
      console.error('Error creating user:', error);
      setApiError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCancel = () => {
    router.push('/admin/users');
  };

  const handleCopyPassword = () => {
    if (createdUserData?.tempPassword) {
      navigator.clipboard.writeText(createdUserData.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateAnother = () => {
    setFormData({
      fullName: '',
      email: '',
      role: '',
      district: '',
      registrationNumber: '',
      registrationType: '',
    });
    setErrors({});
    setSuccess(false);
    setCreatedUserData(null);
    setApiError('');
  };

  const handleViewProfile = () => {
    if (createdUserData?.minerRegistrationId) {
      router.push(`/admin/miners/${createdUserData.minerRegistrationId}`);
    }
  };

  if (success && createdUserData) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="users" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
            <div className="text-sm font-medium text-gray-800">Create new user</div>
            <div className="text-gray-400 text-xs">Admin Panel</div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 p-5">
            <div className="max-w-sm mx-auto">
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                {/* Success Icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="1.5"
                  className="w-10 h-10 mx-auto"
                >
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 12l3 3 5-5"/>
                </svg>

                {/* Success Title */}
                <h3 className="text-gray-900 text-sm font-medium mt-4">Account created</h3>
                <p className="text-gray-400 text-xs mt-1">for {createdUserData.fullName}</p>

                {/* Divider */}
                <div className="border-t border-gray-100 my-5"></div>

                {/* Credentials Box */}
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                    Login credentials
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Share these with the user directly and securely
                  </p>

                  {/* Email Row */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Email</span>
                    <span className="text-xs text-gray-900 font-medium">{createdUserData.email}</span>
                  </div>

                  {/* Password Row */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Temp password</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-900 font-medium">{createdUserData.tempPassword}</span>
                      <button
                        onClick={handleCopyPassword}
                        className="text-gray-400 hover:text-gray-600 transition"
                        title="Copy password"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {copied && <span className="text-xs text-gray-400">Copied</span>}
                    </div>
                  </div>
                </div>

                {/* Warning Box */}
                <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2 rounded-r mt-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    The user must change this password on first login. Share credentials securely - not via email on localhost.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCreateAnother}
                    className="flex-1 bg-white border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    Create another
                  </button>
                  {createdUserData.role === 'miner' && (
                    <button
                      onClick={handleViewProfile}
                      className="flex-1 bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
                    >
                      View profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" activePage="users" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="text-sm font-medium text-gray-800">Create new user</div>
          <div className="text-gray-400 text-xs">Admin Panel</div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="max-w-lg mx-auto p-5">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              {/* Card Header */}
              <h2 className="text-sm font-medium text-gray-900">Create new user account</h2>
              <p className="text-xs text-gray-400 mt-0.5">Admin creates accounts for all system users</p>

              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                {/* Full Name */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                      errors.fullName ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                      errors.email ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="Enter email address"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-1">
                    A temporary password will be generated and shown to you after creation
                  </p>
                </div>

                {/* Role */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                      errors.role ? 'border-red-500' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select role...</option>
                    <option value="miner">Miner</option>
                    <option value="compliance_officer">Compliance Officer</option>
                  </select>
                  {errors.role && (
                    <p className="text-red-500 text-xs mt-1">{errors.role}</p>
                  )}
                </div>

                {/* District (for Miner and Compliance Officer) */}
                {(formData.role === 'miner' || formData.role === 'compliance_officer') && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">District</label>
                    <select
                      value={formData.district}
                      onChange={(e) => handleInputChange('district', e.target.value)}
                      className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                        errors.district ? 'border-red-500' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select district...</option>
                      <option value="Kadoma">Kadoma</option>
                      <option value="Ngezi">Ngezi</option>
                      <option value="Shurugwi">Shurugwi</option>
                      <option value="Zvishavane">Zvishavane</option>
                      <option value="Gwanda">Gwanda</option>
                    </select>
                    {errors.district && (
                      <p className="text-red-500 text-xs mt-1">{errors.district}</p>
                    )}
                  </div>
                )}

                {/* Registration Number (for Miner) */}
                {formData.role === 'miner' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Mining registration number</label>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                        errors.registrationNumber ? 'border-red-500' : 'border-gray-200'
                      }`}
                      placeholder="e.g. COOP-SHU-2021-0042"
                    />
                    {errors.registrationNumber && (
                      <p className="text-red-500 text-xs mt-1">{errors.registrationNumber}</p>
                    )}
                  </div>
                )}

                {/* Registration Type (for Miner) */}
                {formData.role === 'miner' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Registration type</label>
                    <select
                      value={formData.registrationType}
                      onChange={(e) => handleInputChange('registrationType', e.target.value)}
                      className={`h-9 w-full border rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800 ${
                        errors.registrationType ? 'border-red-500' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select type...</option>
                      <option value="cooperative">Cooperative</option>
                      <option value="individual">Individual Licence</option>
                      <option value="company">Company</option>
                      <option value="syndicate">Syndicate</option>
                    </select>
                    {errors.registrationType && (
                      <p className="text-red-500 text-xs mt-1">{errors.registrationType}</p>
                    )}
                  </div>
                )}

                {/* Info Box */}
                <div className="border-l-2 border-gray-300 bg-gray-50 pl-3 py-2 rounded-r">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Miners must complete their KYC profile after first login. Compliance officers and admins have immediate access after password change.
                  </p>
                </div>

                {/* Error Box */}
                {apiError && (
                  <div className="border-l-2 border-gray-400 bg-gray-50 pl-3 py-2 rounded-r mt-4">
                    <p className="text-xs text-gray-600">{apiError}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-white border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
