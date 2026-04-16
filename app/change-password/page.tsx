'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForced, setIsForced] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setIsForced(!!u.must_change_password);
        setUserRole(u.role || '');
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to change password.');
        return;
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user?.miner_reg_number) {
        localStorage.setItem('minerRegNumber', data.user.miner_reg_number);
      } else {
        localStorage.removeItem('minerRegNumber');
      }
      if (data.user?.full_name) {
        localStorage.setItem('minerName', data.user.full_name);
      }
      if (data.user?.miner_kyc_status) {
        localStorage.setItem('minerKycStatus', data.user.miner_kyc_status);
      } else {
        localStorage.removeItem('minerKycStatus');
      }

      if (data.user?.role === 'miner') {
        router.push('/miner/dashboard');
      } else if (data.user?.role === 'compliance_officer') {
        router.push('/admin/compliance');
      } else {
        router.push('/admin/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (userRole === 'miner') router.push('/miner/dashboard');
    else if (userRole === 'compliance_officer') router.push('/admin/compliance');
    else router.push('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-lg font-medium text-gray-900">Change password</div>
        <div className="text-xs text-gray-400 mt-1">
          {isForced
            ? 'You must set a new password before using the system.'
            : 'Update your account password.'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
            {isForced ? 'Temporary password' : 'Current password'}
          </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
              minLength={8}
              required
            />
          </div>

          {error && <div className="text-xs text-gray-600">{error}</div>}

          <div className="flex gap-2">
            {!isForced && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gray-900 text-white text-sm py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
