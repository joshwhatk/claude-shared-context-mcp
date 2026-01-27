/**
 * View page - displays a single context item with rendered markdown
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ContentRenderer } from '../components/ContentRenderer';
import { api } from '../api/client';
import type { ContextEntry } from '../api/client';

export function ViewPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContextEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch item on mount
  useEffect(() => {
    if (!key) {
      navigate('/');
      return;
    }

    const fetchItem = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getContext(key);
        setItem(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [key, navigate]);

  const handleDelete = async () => {
    if (!key) return;

    try {
      setIsDeleting(true);
      await api.deleteContext(key);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 inline-block">
          {error || 'Item not found'}
        </div>
        <div className="mt-4">
          <Link to="/" className="text-sm text-blue-600 hover:text-blue-700">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/"
            className="flex-shrink-0 p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to list"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {item.key}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/edit/${encodeURIComponent(item.key)}`}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md
                     hover:bg-gray-50 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-white border border-gray-300 rounded-md
                     hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <ContentRenderer content={item.content} />
        </div>

        {/* Footer with metadata */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>Created: {formatDate(item.created_at)}</span>
            <span>Updated: {formatDate(item.updated_at)}</span>
            <span>{item.content.length.toLocaleString()} characters</span>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Delete item?</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete "{item.key}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md
                         hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md
                         hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
