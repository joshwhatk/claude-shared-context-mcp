/**
 * Self-service API key management page with setup instructions
 */

import { useState, useEffect, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { api } from '../api/client';
import type { AdminApiKey } from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';
import { CliSetupInstructions } from '../components/SetupInstructions';

// Reuse Modal and ConfirmDialog patterns from AdminPage

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity cursor-pointer"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Revoke',
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isLoading?: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          {isLoading ? 'Revoking...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}

function CliSetupAccordion() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mt-8 bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <h2 className="text-lg font-semibold text-gray-900">Setup Instructions</h2>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4">
          <CliSetupInstructions
            apiKeyHint={
              <>
                Replace <code className="px-1 py-0.5 bg-gray-100 rounded font-mono">&lt;your-api-key&gt;</code> with an API key created above.
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

export function KeysPage() {
  usePageTitle('API Keys');
  const posthog = usePostHog();
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.listMyKeys();
      setKeys(result.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await api.createMyKey(newKeyName.trim());
      posthog?.capture('api_key_created');
      setCreatedKey(result.apiKey);
      setNewKeyName('');
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!revokeConfirm) return;

    setIsRevoking(true);
    try {
      await api.revokeMyKey(revokeConfirm);
      posthog?.capture('api_key_revoked');
      setRevokeConfirm(null);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyCreatedKey = async () => {
    if (createdKey) {
      try {
        await navigator.clipboard.writeText(createdKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } catch {
        const input = document.querySelector('input[readonly]') as HTMLInputElement;
        if (input) {
          input.select();
          input.setSelectionRange(0, 99999);
        }
      }
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">API Keys</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Newly created key banner */}
      {createdKey && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-medium mb-2">
            Save this API key now — it won't be shown again!
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={createdKey}
              className="flex-1 px-3 py-2 border border-yellow-300 rounded-md bg-white font-mono text-sm cursor-text"
              aria-label="Generated API key"
            />
            <button
              onClick={handleCopyCreatedKey}
              className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
            >
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => setCreatedKey(null)}
              className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create new key form */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Create New Key</h2>
        <form onSubmit={handleCreateKey} className="flex gap-2">
          <label htmlFor="new-key-name" className="sr-only">Key name</label>
          <input
            id="new-key-name"
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., laptop, work-machine)"
            pattern="^[a-zA-Z0-9_-]+$"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isCreating || !newKeyName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isCreating ? 'Creating...' : 'Create Key'}
          </button>
        </form>
        <p className="mt-1.5 text-xs text-gray-500">
          Alphanumeric, dashes, and underscores only
        </p>
      </div>

      {/* Keys list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No API keys yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{key.name}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(key.last_used_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => setRevokeConfirm(key.name)}
                        className="text-sm text-red-600 hover:text-red-800 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Setup instructions */}
      <CliSetupAccordion />

      {/* Revoke confirmation dialog */}
      <ConfirmDialog
        isOpen={!!revokeConfirm}
        onClose={() => setRevokeConfirm(null)}
        onConfirm={handleRevokeKey}
        title="Revoke API Key"
        message={`Are you sure you want to revoke the API key "${revokeConfirm}"? This action cannot be undone and any applications using this key will lose access.`}
        confirmText="Revoke"
        isLoading={isRevoking}
      />
    </div>
  );
}
