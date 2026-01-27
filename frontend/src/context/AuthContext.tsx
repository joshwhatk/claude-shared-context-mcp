/**
 * Authentication context for managing user session
 */

import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '../api/client';
import type { AuthVerifyResponse } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthVerifyResponse | null;
  isAdmin: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (apiKey: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    isAdmin: false,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!api.isAuthenticated()) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          isAdmin: false,
          error: null,
        });
        return;
      }

      try {
        const user = await api.verifyAuth();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          isAdmin: user.isAdmin ?? false,
          error: null,
        });
      } catch {
        // Invalid or expired key
        api.clearApiKey();
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          isAdmin: false,
          error: null,
        });
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (apiKey: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      api.setApiKey(apiKey);
      const user = await api.verifyAuth();

      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        isAdmin: user.isAdmin ?? false,
        error: null,
      });

      return true;
    } catch (err) {
      api.clearApiKey();

      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        isAdmin: false,
        error: err instanceof Error ? err.message : 'Authentication failed',
      });

      return false;
    }
  }, []);

  const logout = useCallback(() => {
    api.clearApiKey();
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      isAdmin: false,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
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
