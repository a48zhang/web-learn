import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface TopNavProps {
  onMenuClick: () => void;
}

interface NavLinkItem {
  label: string;
  to: string;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const navLinks: NavLinkItem[] = isAuthenticated
    ? [
        { label: '控制台', to: '/dashboard' },
        { label: '专题列表', to: '/topics' },
        ...(user?.role === 'teacher' ? [{ label: '新建专题', to: '/topics/create' }] : []),
      ]
    : [
        { label: '登录', to: '/login' },
        { label: '注册', to: '/register' },
      ];

  const isActive = (to: string) =>
    location.pathname === to ||
    (location.pathname.startsWith(to + '/') && to !== '/');


  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-4 sm:px-6 justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="font-bold text-blue-600 text-lg">
          WebLearn
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                isActive(link.to)
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5 text-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm'
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <>
            <span className="hidden md:inline text-sm text-gray-700 dark:text-gray-300">{user.username}</span>
            <span
              className={`hidden md:inline text-xs font-medium px-2 py-0.5 rounded-full ${
                user.role === 'teacher'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {user.role === 'teacher' ? '教师' : '学生'}
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hidden md:inline"
            >
              退出
            </button>
          </>
        ) : null}

        <button
          className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onMenuClick}
          aria-label="打开菜单"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
