/**
 * Edit/Create page with Milkdown WYSIWYG editor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ContextEntry } from '../api/client';
import { MarkdownEditor } from '../components/MarkdownEditor';
import type { MarkdownEditorRef } from '../components/MarkdownEditor';
import { usePageTitle } from '../hooks/usePageTitle';

// Key validation pattern (must match backend)
const KEY_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;
const MAX_KEY_LENGTH = 255;

function validateKey(key: string): string | null {
  if (!key.trim()) {
    return 'Key is required';
  }
  if (key.length > MAX_KEY_LENGTH) {
    return `Key must be ${MAX_KEY_LENGTH} characters or less`;
  }
  if (!KEY_PATTERN.test(key)) {
    return 'Key can only contain letters, numbers, dashes, underscores, and dots';
  }
  return null;
}

export function EditPage() {
  const { key: existingKey } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<MarkdownEditorRef>(null);

  const isNew = !existingKey;
  usePageTitle(isNew ? 'New Item' : existingKey ? `Edit ${existingKey}` : undefined);

  const [key, setKey] = useState(existingKey || '');
  const [item, setItem] = useState<ContextEntry | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing item if editing
  useEffect(() => {
    if (isNew || !existingKey) return;

    const fetchItem = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getContext(existingKey);
        setItem(data);
        setKey(data.key);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [existingKey, isNew]);

  // Track changes in editor
  const handleEditorChange = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Validate key on change
  const handleKeyChange = (value: string) => {
    setKey(value);
    setKeyError(null);
    setHasChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    // Validate key for new items
    if (isNew) {
      const keyValidationError = validateKey(key);
      if (keyValidationError) {
        setKeyError(keyValidationError);
        return;
      }
    }

    // Get content from editor
    const content = editorRef.current?.getMarkdown() || '';

    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const targetKey = isNew ? key : existingKey!;
      await api.saveContext(targetKey, content);

      // Navigate to view page
      navigate(`/view/${encodeURIComponent(targetKey)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle navigation with unsaved changes
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(isNew ? '/' : `/view/${encodeURIComponent(existingKey!)}`);
      }
    } else {
      navigate(isNew ? '/' : `/view/${encodeURIComponent(existingKey!)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isNew && error && !item) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 inline-block">
          {error}
        </div>
        <div className="mt-4">
          <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={handleCancel}
            className="flex-shrink-0 p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 rounded"
            title="Cancel"
            aria-label="Cancel"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {isNew ? 'New Item' : 'Edit Item'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md
                     hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                     hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Key input for new items */}
      {isNew && (
        <div className="mb-6">
          <label
            htmlFor="key"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Key
          </label>
          <input
            type="text"
            id="key"
            value={key}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="my-context-key"
            className={`w-full px-3 py-2 text-sm border rounded-md
                     placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     ${keyError ? 'border-red-300' : 'border-gray-300'}`}
            disabled={isSaving}
          />
          {keyError && (
            <p className="mt-1 text-sm text-red-600">{keyError}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Only letters, numbers, dashes, underscores, and dots allowed
          </p>
        </div>
      )}

      {/* Editor */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Content
        </label>
        <MarkdownEditor
          ref={editorRef}
          defaultValue={item?.content || ''}
          onChange={handleEditorChange}
          placeholder="Start writing..."
        />
      </div>

      {/* Character count */}
      <p className="text-xs text-gray-400 text-right">
        Max 100KB
      </p>
    </div>
  );
}
