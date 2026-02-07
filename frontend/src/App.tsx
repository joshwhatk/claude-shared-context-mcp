/**
 * Main App component with routing
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { ListPage } from './pages/ListPage';
import { ViewPage } from './pages/ViewPage';
import { EditPage } from './pages/EditPage';
import { AdminPage } from './pages/AdminPage';
import { KeysPage } from './pages/KeysPage';
import { SetupPage } from './pages/SetupPage';
import { MarketingPage } from './pages/MarketingPage';

/**
 * Protected route wrapper - requires Clerk sign-in
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Admin-only route wrapper
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { isAdmin, isLoading } = useAuth();

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

/**
 * Public route wrapper (redirects authenticated users to app)
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing page */}
      <Route path="/" element={<MarketingPage />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      {/* App routes (protected) */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout>
              <ListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/view/:key"
        element={
          <ProtectedRoute>
            <Layout>
              <ViewPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/edit/:key"
        element={
          <ProtectedRoute>
            <Layout>
              <EditPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/new"
        element={
          <ProtectedRoute>
            <Layout>
              <EditPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/setup"
        element={
          <ProtectedRoute>
            <Layout>
              <SetupPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/keys"
        element={
          <ProtectedRoute>
            <Layout>
              <KeysPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/admin"
        element={
          <AdminRoute>
            <Layout>
              <AdminPage />
            </Layout>
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
