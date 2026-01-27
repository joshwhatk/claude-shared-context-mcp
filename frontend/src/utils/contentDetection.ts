/**
 * Content type detection utility for auto-rendering JSON vs Markdown
 */

export type ContentType = 'json' | 'markdown';

/**
 * Detects whether content is JSON or Markdown.
 * Uses JSON.parse() with a prefix check to reliably detect JSON.
 * Handles edge cases like markdown containing JSON code blocks.
 */
export function detectContentType(content: string): ContentType {
  const trimmed = content.trim();

  // JSON must start with { or [
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return 'markdown';
  }

  try {
    const parsed = JSON.parse(trimmed);
    // Must be a non-null object or array
    if (typeof parsed === 'object' && parsed !== null) {
      return 'json';
    }
    return 'markdown';
  } catch {
    return 'markdown';
  }
}
