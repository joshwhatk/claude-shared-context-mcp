/**
 * List page - shows all context items
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { api } from '../api/client';
import type { ContextEntry } from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';

export function ListPage() {
  usePageTitle('Context Items');
  const posthog = usePostHog();
  const [items, setItems] = useState<ContextEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch all items on mount
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.getAllContext(50);
        setItems(response.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.key.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Track search usage with 1s debounce
  useEffect(() => {
    if (!searchQuery.trim()) return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      posthog?.capture('context_searched', { has_results: filteredItems.length > 0 });
    }, 1000);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, filteredItems.length, posthog]);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 120) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength).trim() + '...';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with search and new button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Context Items</h1>
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* New item button */}
          <Link
            to="/app/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                     hover:bg-blue-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                     transition-colors whitespace-nowrap"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            New
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            No context items
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new item.
          </p>
          <div className="mt-6">
            <Link
              to="/app/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                       hover:bg-blue-700 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Item
            </Link>
          </div>
        </div>
      )}

      {/* No results for search */}
      {!error && items.length > 0 && filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">
            No items match "{searchQuery}"
          </p>
        </div>
      )}

      {/* Item list */}
      {filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Link
              key={item.key}
              to={`/app/view/${encodeURIComponent(item.key)}`}
              className="block bg-white rounded-lg border border-gray-200 p-4
                       hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Key name */}
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {item.key}
                  </h3>
                  {/* Content preview */}
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {truncateContent(item.content)}
                  </p>
                </div>
                {/* Timestamp */}
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {formatRelativeTime(item.updated_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Item count */}
      {items.length > 0 && (
        <p className="mt-4 text-xs text-gray-400 text-center">
          {filteredItems.length === items.length
            ? `${items.length} item${items.length === 1 ? '' : 's'}`
            : `${filteredItems.length} of ${items.length} items`}
        </p>
      )}
    </div>
  );
}
