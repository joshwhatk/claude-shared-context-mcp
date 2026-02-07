/**
 * Authentication context wrapping Clerk's useAuth/useUser hooks
 * Provides isAdmin from the backend since admin status is stored in PostgreSQL
 */

import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { usePostHog } from 'posthog-js/react';
import { api } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  email: string | null;
  userId: string | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isSignedIn, isLoaded: isAuthLoaded, getToken } = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const posthog = usePostHog();

  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    isAdmin: false,
    email: null,
    userId: null,
    error: null,
  });

  // Set the token getter on the API client so all requests use Clerk JWT
  useEffect(() => {
    api.setTokenGetter(getToken);
  }, [getToken]);

  // Fetch admin status from backend when user signs in
  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded) {
      return;
    }

    if (!isSignedIn) {
      posthog?.reset();
      setState({
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        email: null,
        userId: null,
        error: null,
      });
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const userInfo = await api.getAuthMe();
        posthog?.identify(userInfo.userId, {
          email: clerkUser?.primaryEmailAddress?.emailAddress,
          is_admin: userInfo.isAdmin,
        });
        setState({
          isAuthenticated: true,
          isLoading: false,
          isAdmin: userInfo.isAdmin,
          email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
          userId: userInfo.userId,
          error: null,
        });
      } catch (err) {
        posthog?.capture('auth_error', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        console.error('[auth] Failed to fetch user info:', err);
        setState({
          isAuthenticated: false,
          isLoading: false,
          isAdmin: false,
          email: null,
          userId: null,
          error: err instanceof Error ? err.message : 'Failed to load user info',
        });
      }
    };

    fetchUserInfo();
  }, [isSignedIn, isAuthLoaded, isUserLoaded, clerkUser, posthog]);

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
