/**
 * Login page - Clerk OAuth sign-in
 */

import { SignIn } from '@clerk/clerk-react';

export function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Shared Context
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your shared context
          </p>
        </div>

        {/* Clerk Sign In */}
        <div className="flex justify-center">
          <SignIn />
        </div>
      </div>
    </div>
  );
}
