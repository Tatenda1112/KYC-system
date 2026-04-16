'use client';

import { useRouter } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  locked?: boolean;
}

interface SidebarProps {
  role: 'admin' | 'compliance_officer' | 'miner';
  activePage: string;
  userName?: string;
  kycStatus?: string;
}

export default function Sidebar({ role, activePage, userName, kycStatus }: SidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'admin':
        return [
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Users', href: '/admin/users' },
          { label: 'Miners', href: '/admin/miners' },
          { label: 'Customers', href: '/admin/customers' },
          { label: 'Transactions', href: '/admin/transactions' },
          { label: 'Compliance', href: '/admin/compliance' },
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Audit log', href: '/admin/audit' },
        ];
      case 'miner': {
        const kycLocked = !!kycStatus && kycStatus !== 'Verified';
        return [
          { label: 'My dashboard', href: '/miner/dashboard' },
          { label: 'Register KYC', href: '/miner/register' },
          { label: 'My customers', href: '/miner/customers', locked: kycLocked },
          { label: 'Record sale', href: '/miner/transactions/new', locked: kycLocked },
          { label: 'My transactions', href: '/miner/transactions', locked: kycLocked },
          { label: 'Download report', href: '/miner/reports', locked: kycLocked },
          { label: 'Change password', href: '/change-password' },
        ];
      }
      case 'compliance_officer':
        return [
          { label: 'Dashboard', href: '/officer/dashboard' },
          { label: 'My district', href: '/officer/district' },
          { label: 'Compliance checks', href: '/officer/compliance' },
          { label: 'Reports', href: '/officer/reports' },
          { label: 'Change password', href: '/change-password' },
        ];
      default:
        return [];
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return 'Admin Panel';
      case 'miner': return 'Miner Portal';
      case 'compliance_officer': return 'Officer Portal';
      default: return '';
    }
  };

  const navItems = getNavItems();

  return (
    <div className="w-48 bg-gray-900 h-full flex flex-col">
      {/* Logo Area */}
      <div className="p-4 border-b border-gray-800">
        <div className="text-white text-xs font-medium leading-tight">
          CDD/KYC Compliance
        </div>
        <div className="text-gray-600 text-xs mt-0.5">
          {getRoleLabel()}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = activePage === item.label.toLowerCase().replace(' ', '');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 text-xs transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : item.locked
                  ? 'text-gray-600 hover:text-gray-500 cursor-pointer'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div
                className={`w-1 h-1 rounded-full flex-shrink-0 ${
                  isActive ? 'bg-white' : 'bg-gray-600'
                }`}
              />
              <span className="flex-1">{item.label}</span>
              {item.locked && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-3 h-3 flex-shrink-0 text-gray-600"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              )}
            </a>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-800">
        {userName && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-gray-300">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-300 truncate leading-tight">{userName}</div>
              <div className="text-xs text-gray-600 capitalize leading-tight mt-0.5">{role.replace('_', ' ')}</div>
            </div>
          </div>
        )}
        <div className="px-4 pb-3">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
