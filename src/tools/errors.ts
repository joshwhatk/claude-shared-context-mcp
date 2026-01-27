/**
 * Standardized error handling for MCP tools
 */

// Error codes for tool responses
export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * Custom error class for tool errors
 */
export class ToolError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ToolError';
  }
}

/**
 * Format a successful tool response
 */
export function formatSuccess<T>(data: T, timestamp?: Date): ToolSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(timestamp && { timestamp: timestamp.toISOString() }),
  };
}

/**
 * Format an error tool response
 */
export function formatError(error: ToolError | Error): ToolErrorResponse {
  if (error instanceof ToolError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }

  // Generic error fallback
  console.error('[tools] Unexpected error:', error);
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
  };
}

/**
 * Type definitions for tool responses
 */
export interface ToolSuccessResponse<T> {
  success: true;
  data: T;
  timestamp?: string;
}

export interface ToolErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
}

export type ToolResponse<T> = ToolSuccessResponse<T> | ToolErrorResponse;

/**
 * Helper to create MCP tool content response
 */
export function createToolResponse<T>(response: ToolResponse<T>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
  };
}

/**
 * Helper to handle tool execution with error boundary
 */
export async function executeWithErrorBoundary<T>(
  fn: () => Promise<T>
): Promise<ToolResponse<T>> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (error) {
    if (error instanceof ToolError) {
      return formatError(error);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return formatError(err);
  }
}
