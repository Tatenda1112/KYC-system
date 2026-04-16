'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('=== LOGIN SUBMIT ===');
      console.log('Login attempt:', { email, password: '***' });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Login error:', errorData);
        setError(errorData.error || 'Login failed. Please check your credentials.');
        return;
      }

      let data;
      try {
        const responseText = await response.text();
        console.log('Login API raw response:', responseText.substring(0, 200) + '...');
        
        data = JSON.parse(responseText);
        console.log('Login success:', data);
      } catch (jsonError) {
        console.log('JSON parse error:', jsonError);
        const responseText = await response.text();
        console.error('Login API returned non-JSON:', responseText.substring(0, 500));
        setError('Server error. Please try again later.');
        return;
      }

      if (!data.success || !data.user) {
        setError('Invalid credentials');
        return;
      }

      // Store token and user info in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.miner_reg_number) {
        localStorage.setItem('minerRegNumber', data.user.miner_reg_number);
      } else {
        localStorage.removeItem('minerRegNumber');
      }
      if (data.user.full_name) {
        localStorage.setItem('minerName', data.user.full_name);
      }
      if (data.user.miner_kyc_status) {
        localStorage.setItem('minerKycStatus', data.user.miner_kyc_status);
      } else {
        localStorage.removeItem('minerKycStatus');
      }

      if (data.user.must_change_password) {
        router.push('/change-password');
        return;
      }

      // Redirect based on role
      const userRole = data.user.role;
      console.log('Redirecting user with role:', userRole);

      if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else if (userRole === 'miner') {
        router.push('/miner/dashboard');
      } else if (userRole === 'compliance_officer') {
        router.push('/admin/compliance');
      } else {
        router.push('/admin/dashboard'); // Default fallback
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-2/5 bg-gray-900 flex items-center justify-center relative">
        <div className="text-center">
          <div className="text-gray-600 text-xs tracking-widest uppercase">
            ZIMBABWE PRECIOUS MINERALS SECTOR
          </div>
          <div className="text-white text-xl font-medium mt-3">
            CDD/KYC Compliance System
          </div>
          <div className="text-gray-500 text-sm mt-2">
            Regulatory compliance. Verified identity.
          </div>
        </div>
        <div className="text-gray-700 text-xs absolute bottom-8">
          Harare Institute of Technology &bull; 2025
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-3/5 bg-white flex items-center justify-center">
        <div className="max-w-xs mx-auto w-full">
          <div className="text-gray-900 text-lg font-medium mb-1">
            Sign in
          </div>
          <div className="text-gray-400 text-xs mb-6">
            Compliance portal access
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full border border-gray-200 rounded-md bg-gray-50 px-3 text-sm text-gray-800 focus:outline-none focus:border-gray-800"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40 cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {error && (
              <div className="text-gray-600 text-xs text-center mt-4">
                {error}
              </div>
            )}

            <div className="text-gray-400 text-xs text-center mt-4">
              Contact your administrator to register
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
