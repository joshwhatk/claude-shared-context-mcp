/**
 * Input validation utilities for MCP tools
 */

// Key constraints
const MAX_KEY_LENGTH = 255;
const KEY_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;

// Content constraints
const MAX_CONTENT_SIZE = 102400; // 100KB

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a context key
 * - Must be alphanumeric with dash, underscore, or dot
 * - Maximum 255 characters
 */
export function validateKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key is required and must be a string' };
  }

  if (key.length === 0) {
    return { valid: false, error: 'Key cannot be empty' };
  }

  if (key.length > MAX_KEY_LENGTH) {
    return { valid: false, error: `Key exceeds maximum length of ${MAX_KEY_LENGTH} characters` };
  }

  if (!KEY_PATTERN.test(key)) {
    return {
      valid: false,
      error: 'Key must contain only alphanumeric characters, dashes, underscores, or dots',
    };
  }

  return { valid: true };
}

/**
 * Validate content size
 * - Maximum 100KB
 */
export function validateContent(content: string): ValidationResult {
  if (content === undefined || content === null) {
    return { valid: false, error: 'Content is required' };
  }

  if (typeof content !== 'string') {
    return { valid: false, error: 'Content must be a string' };
  }

  const byteLength = Buffer.byteLength(content, 'utf8');
  if (byteLength > MAX_CONTENT_SIZE) {
    return {
      valid: false,
      error: `Content exceeds maximum size of ${MAX_CONTENT_SIZE} bytes (${Math.round(MAX_CONTENT_SIZE / 1024)}KB)`,
    };
  }

  return { valid: true };
}

/**
 * Validate limit parameter
 * - Must be a positive integer within bounds
 */
export function validateLimit(limit: number, maxLimit: number, defaultLimit: number): number {
  if (limit === undefined || limit === null) {
    return defaultLimit;
  }

  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(1, limit), maxLimit);
}

/**
 * Sanitize search string for SQL LIKE queries
 * Escapes special characters: %, _, \
 */
export function sanitizeSearch(search: string): string {
  if (!search || typeof search !== 'string') {
    return '';
  }

  return search
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
