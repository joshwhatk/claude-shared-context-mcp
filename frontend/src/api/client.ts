/**
 * API client for communicating with the backend
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

export interface AuthVerifyResponse {
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

export interface AdminApiKey {
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AdminListUsersResponse {
  users: AdminUser[];
  count: number;
}

export interface AdminCreateUserResponse {
  user: {
    id: string;
    email: string;
    is_admin: boolean;
    created_at: string;
  };
  apiKey: string;
  keyName: string;
}

export interface AdminListKeysResponse {
  userId: string;
  keys: AdminApiKey[];
  count: number;
}

export interface AdminCreateKeyResponse {
  userId: string;
  apiKey: string;
  keyName: string;
}

export interface SaveResponse extends ContextEntry {
  action: 'created' | 'updated';
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

// API key storage
const API_KEY_STORAGE_KEY = 'mcp_api_key';

class ApiClient {
  private apiKey: string | null = null;

  /**
   * Set the API key and store in sessionStorage
   */
  setApiKey(key: string): void {
    this.apiKey = key;
    sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    if (!this.apiKey) {
      this.apiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    }
    return this.apiKey;
  }

  /**
   * Clear the API key (logout)
   */
  clearApiKey(): void {
    this.apiKey = null;
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Make an authenticated API request
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
   * Verify API key and get user info
   */
  async verifyAuth(): Promise<AuthVerifyResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key provided');
    }

    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Verification failed');
    }

    return data.data;
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
   * Create a new user with API key (admin only)
   */
  async adminCreateUser(
    userId: string,
    email: string,
    keyName = 'default'
  ): Promise<AdminCreateUserResponse> {
    return this.fetch<AdminCreateUserResponse>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ userId, email, keyName }),
    });
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

  /**
   * List API keys for a user (admin only)
   */
  async adminListUserKeys(userId: string): Promise<AdminListKeysResponse> {
    return this.fetch<AdminListKeysResponse>(
      `/admin/users/${encodeURIComponent(userId)}/keys`
    );
  }

  /**
   * Create a new API key for a user (admin only)
   */
  async adminCreateKey(userId: string, name: string): Promise<AdminCreateKeyResponse> {
    return this.fetch<AdminCreateKeyResponse>(
      `/admin/users/${encodeURIComponent(userId)}/keys`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    );
  }

  /**
   * Revoke an API key (admin only)
   */
  async adminRevokeKey(
    userId: string,
    keyName: string
  ): Promise<{ userId: string; keyName: string; revoked: boolean }> {
    return this.fetch<{ userId: string; keyName: string; revoked: boolean }>(
      `/admin/users/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyName)}`,
      { method: 'DELETE' }
    );
  }
}

// Export singleton instance
export const api = new ApiClient();
