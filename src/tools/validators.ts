/**
 * Input validation utilities for MCP tools
 */

// Key constraints
const MAX_KEY_LENGTH = 255;
const KEY_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;

// User ID constraints
const MAX_USER_ID_LENGTH = 50;
const USER_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

// Email validation - basic but effective pattern
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321

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

/**
 * Validate a user ID
 * - Must be alphanumeric with dash or underscore
 * - Maximum 50 characters
 */
export function validateUserId(userId: string): ValidationResult {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required and must be a string' };
  }

  if (userId.length === 0) {
    return { valid: false, error: 'User ID cannot be empty' };
  }

  if (userId.length > MAX_USER_ID_LENGTH) {
    return { valid: false, error: `User ID exceeds maximum length of ${MAX_USER_ID_LENGTH} characters` };
  }

  if (!USER_ID_PATTERN.test(userId)) {
    return {
      valid: false,
      error: 'User ID must contain only alphanumeric characters, dashes, or underscores',
    };
  }

  return { valid: true };
}

/**
 * Validate an email address
 * - Basic format check (not exhaustive RFC compliance)
 * - Maximum 254 characters (RFC 5321)
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' };
  }

  if (email.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email exceeds maximum length of ${MAX_EMAIL_LENGTH} characters` };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

// Name constraints (for waitlist)
const MAX_NAME_LENGTH = 100;
const NAME_PATTERN = /^[a-zA-ZÀ-ÖØ-öø-ÿ\s\-']+$/;

// Valid preferred login providers
const VALID_PREFERRED_LOGINS = ['google', 'github', 'microsoft', 'apple'] as const;

/**
 * Validate a name (first or last) for waitlist
 * - Must be non-empty
 * - Maximum 100 characters
 * - Letters, spaces, hyphens, apostrophes
 */
export function validateName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required and must be a string' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name exceeds maximum length of ${MAX_NAME_LENGTH} characters` };
  }

  if (!NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must contain only letters, spaces, hyphens, or apostrophes',
    };
  }

  return { valid: true };
}

/**
 * Validate preferred login provider for waitlist
 * Must be one of: google, github, microsoft, apple
 */
export function validatePreferredLogin(login: string): ValidationResult {
  if (!login || typeof login !== 'string') {
    return { valid: false, error: 'Preferred login is required and must be a string' };
  }

  if (!(VALID_PREFERRED_LOGINS as readonly string[]).includes(login)) {
    return {
      valid: false,
      error: `Preferred login must be one of: ${VALID_PREFERRED_LOGINS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate an API key name
 * - Must be non-empty string
 * - Maximum 100 characters
 * - Alphanumeric with spaces, dashes, underscores
 */
export function validateApiKeyName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'API key name is required and must be a string' };
  }

  if (name.length === 0) {
    return { valid: false, error: 'API key name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'API key name exceeds maximum length of 100 characters' };
  }

  // Allow spaces, alphanumeric, dash, underscore
  const namePattern = /^[a-zA-Z0-9_\- ]+$/;
  if (!namePattern.test(name)) {
    return {
      valid: false,
      error: 'API key name must contain only alphanumeric characters, spaces, dashes, or underscores',
    };
  }

  return { valid: true };
}
