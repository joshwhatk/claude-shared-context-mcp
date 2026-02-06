/**
 * API client for communicating with the backend using Clerk JWT tokens
 */

// Types matching backend response formats
export interface ContextKeyInfo {
  key: string;
  updated_at: string;
}

export interface ContextEntry {
  key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ListResponse {
  entries: ContextKeyInfo[];
  count: number;
  limit: number;
  search?: string;
}

export interface AllContextResponse {
  entries: ContextEntry[];
  count: number;
  limit: number;
}

export interface AuthMeResponse {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  authenticated: boolean;
}

// Admin types
export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
  auth_provider: string;
  created_at: string;
  updated_at: string;
  api_key_count: number;
  context_entry_count: number;
}

export interface AdminListUsersResponse {
  users: AdminUser[];
  count: number;
}

export interface SaveResponse extends ContextEntry {
  action: 'created' | 'updated';
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

type TokenGetter = () => Promise<string | null>;

class ApiClient {
  private getToken: TokenGetter | null = null;

  /**
   * Set the Clerk token getter function
   * Called by AuthContext with useAuth().getToken
   */
  setTokenGetter(getter: TokenGetter): void {
    this.getToken = getter;
  }

  /**
   * Make an authenticated API request using Clerk JWT
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.getToken) {
      throw new Error('Token getter not configured');
    }

    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      const error = new Error(data.error || 'API error') as Error & {
        code?: string;
      };
      error.code = data.code;
      throw error;
    }

    return data.data;
  }

  /**
   * GET /api/auth/me - Get current user info
   */
  async getAuthMe(): Promise<AuthMeResponse> {
    return this.fetch<AuthMeResponse>('/auth/me');
  }

  /**
   * List context items
   */
  async listContext(limit?: number, search?: string): Promise<ListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (search) params.set('search', search);

    const queryString = params.toString();
    return this.fetch<ListResponse>(`/context${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get all context items with content
   */
  async getAllContext(limit?: number): Promise<AllContextResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));

    const queryString = params.toString();
    return this.fetch<AllContextResponse>(`/context/all${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single context item
   */
  async getContext(key: string): Promise<ContextEntry> {
    return this.fetch<ContextEntry>(`/context/${encodeURIComponent(key)}`);
  }

  /**
   * Save (create or update) a context item
   */
  async saveContext(key: string, content: string): Promise<SaveResponse> {
    return this.fetch<SaveResponse>(`/context/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  /**
   * Delete a context item
   */
  async deleteContext(key: string): Promise<{ key: string; deleted: boolean }> {
    return this.fetch<{ key: string; deleted: boolean }>(
      `/context/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    );
  }

  // ============================================
  // Admin API Methods
  // ============================================

  /**
   * List all users (admin only)
   */
  async adminListUsers(): Promise<AdminListUsersResponse> {
    return this.fetch<AdminListUsersResponse>('/admin/users');
  }

  /**
   * Delete a user (admin only)
   */
  async adminDeleteUser(userId: string): Promise<{ userId: string; deleted: boolean }> {
    return this.fetch<{ userId: string; deleted: boolean }>(
      `/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  }
}

// Export singleton instance
export const api = new ApiClient();
