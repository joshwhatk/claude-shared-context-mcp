/**
 * Layout component with header and navigation
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <Link
              to="/"
              className="text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Shared Context MCP
            </Link>

            {/* Navigation and user menu */}
            <div className="flex items-center gap-4">
              <Link
                to="/setup"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Setup
              </Link>
              <Link
                to="/keys"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                API Keys
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Admin
                </Link>
              )}
              <UserButton />
            </div>
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
