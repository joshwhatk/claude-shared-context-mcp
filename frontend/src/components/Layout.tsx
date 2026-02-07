/**
 * Layout component with header and navigation
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { to: '/app', label: 'My Context' },
  { to: '/app/setup', label: 'Setup' },
  { to: '/app/keys', label: 'API Keys' },
];

export function Layout({ children }: LayoutProps) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header ref={headerRef} className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <Link
              to="/app"
              className="text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Shared Context MCP
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/app/admin"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Admin
                </Link>
              )}
              <UserButton />
            </div>

            {/* Mobile: user button + hamburger */}
            <div className="flex md:hidden items-center gap-3">
              <UserButton />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900 cursor-pointer"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-200 ${
            isMobileMenuOpen ? 'max-h-64 border-t border-gray-100' : 'max-h-0'
          }`}
        >
          <div className="px-4 py-3 space-y-2 bg-white">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/app/admin"
                className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
