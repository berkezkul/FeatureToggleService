import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Logo />
        </div>
        <nav className="nav">
          <Link
            to="/features"
            className={location.pathname.startsWith('/features') ? 'nav-link active' : 'nav-link'}
          >
            Features
          </Link>
          <Link
            to="/audit-logs"
            className={location.pathname.startsWith('/audit-logs') ? 'nav-link active' : 'nav-link'}
          >
            Audit Logs
          </Link>
          <Link
            to="/promotion"
            className={location.pathname.startsWith('/promotion') ? 'nav-link active' : 'nav-link'}
          >
            Promotion
          </Link>
          <Link
            to="/login"
            className={location.pathname === '/login' ? 'nav-link active' : 'nav-link'}
          >
            Login
          </Link>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
};

