/**
 * Login page - API key authentication
 */

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, error, isLoading, clearError } = useAuth();
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    await login(apiKey.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Shared Context
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your API key to access your shared context
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (error) clearError();
                }}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                         placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-500"
                disabled={isLoading}
                autoComplete="current-password"
                autoFocus
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:bg-blue-400 disabled:cursor-not-allowed
                       transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Your API key is stored in session storage and cleared when you close the tab.
        </p>
      </div>
    </div>
  );
}
