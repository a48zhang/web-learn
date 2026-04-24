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
        { label: '新建专题', to: '/topics/create' },
      ]
    : [
        { label: '登录', to: '/login' },
        { label: '注册', to: '/register' },
      ];

  const isActive = (to: string) =>
    location.pathname === to ||
    (location.pathname.startsWith(to + '/') && to !== '/');

  return (
    <header
      data-testid="top-nav"
      className="glass-surface flex h-14 items-center justify-between border-x-0 border-t-0 border-b border-border/80 px-4 sm:px-6"
    >
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="font-display text-lg font-bold tracking-tight text-slate-50">
          WebLearn
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                isActive(link.to)
                  ? 'rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary'
                  : 'rounded-full px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-surface-2 hover:text-slate-100'
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
            <span className="hidden text-sm text-slate-300 md:inline">{user.username}</span>
            <button
              type="button"
              onClick={logout}
              className="hidden text-sm text-slate-400 transition-colors hover:text-slate-100 md:inline"
            >
              退出
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="rounded-full p-2 text-slate-300 transition-colors hover:bg-surface-2 hover:text-slate-50 md:hidden"
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
