'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/Sidebar';
import { fmtDatetime } from '../../../lib/date';
import StatusBadge from '../../../components/StatusBadge';

const BACKEND = 'http://localhost:8000';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  role: string;
  district?: string | null;
  must_change_password?: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${BACKEND}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        let message = 'Failed to fetch users';
        try {
          const errorData = await response.json();
          message = errorData.detail || errorData.error || message;
        } catch {}

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }
        throw new Error(message);
      }

      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND}/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        let message = 'Failed to delete user';
        try {
          const data = await response.json();
          message = data.detail || data.error || message;
        } catch {}
        setDeleteError(message);
        return;
      }

      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar role="admin" activePage="users" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-5">
            <div className="text-sm font-medium text-gray-800">Users</div>
            <div className="text-gray-400 text-xs">Admin Panel</div>
          </div>
          <div className="flex-1 overflow-auto bg-gray-50 p-5">
            <div className="animate-pulse">
              <div className="bg-white border border-gray-200 rounded-lg h-64"></div>
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
          <div className="text-sm font-medium text-gray-800">Users</div>
          <div className="text-gray-400 text-xs">Admin Panel</div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 p-5">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-gray-800">System Users</h3>
                <p className="text-gray-400 text-xs mt-1">Manage all user accounts</p>
              </div>
              <button
                onClick={() => router.push('/admin/users/new')}
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 transition"
              >
                Create User
              </button>
            </div>

            {error && (
              <div className="mx-4 mt-4 border-l-2 border-gray-400 bg-gray-50 px-3 py-2 rounded-r">
                <p className="text-xs text-gray-600">{error}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-xs text-gray-400 uppercase tracking-wider font-medium text-left px-4 py-3">
                      User
                    </th>
                    <th className="text-xs text-gray-400 uppercase tracking-wider font-medium text-left px-4 py-3">
                      Role
                    </th>
                    <th className="text-xs text-gray-400 uppercase tracking-wider font-medium text-left px-4 py-3">
                      Status
                    </th>
                    <th className="text-xs text-gray-400 uppercase tracking-wider font-medium text-left px-4 py-3">
                      Created
                    </th>
                    <th className="text-xs text-gray-400 uppercase tracking-wider font-medium text-left px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="text-sm text-gray-700 px-4 py-3">
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-gray-400 text-xs">{user.email}</div>
                        </div>
                      </td>
                      <td className="text-sm text-gray-700 px-4 py-3">
                        <span className="capitalize">{user.role || 'user'}</span>
                      </td>
                      <td className="text-sm text-gray-700 px-4 py-3">
                        <StatusBadge status={user.is_active ? 'verified' : 'pending'} />
                      </td>
                      <td className="text-sm text-gray-400 text-xs px-4 py-3">
                        {fmtDatetime(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {user.email !== 'tatendatatenda1112@gmail.com' && (
                          <button
                            onClick={() => { setDeleteTarget(user); setDeleteError(''); }}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-80 shadow-lg">
            <div className="text-sm font-medium text-gray-900 mb-1">Delete user</div>
            <div className="text-xs text-gray-500 mb-4">
              Are you sure you want to permanently delete{' '}
              <span className="font-medium text-gray-700">{deleteTarget.full_name}</span>?
              This cannot be undone.
            </div>

            {deleteError && (
              <div className="mb-3 text-xs text-red-600 border-l-2 border-red-300 pl-2">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-gray-900 text-white text-sm py-2 rounded-md hover:bg-gray-800 transition disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
