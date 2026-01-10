import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Express middleware for Bearer token authentication
 * Uses timing-safe comparison to prevent timing attacks
 */
export function validateAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Check for Authorization header
  if (!authHeader) {
    console.warn('[auth] Missing Authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
      },
      id: null,
    });
    return;
  }

  // Check for Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[auth] Invalid Authorization format', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid authorization format. Expected: Bearer <token>',
      },
      id: null,
    });
    return;
  }

  const providedToken = authHeader.slice(7); // Remove 'Bearer ' prefix
  const expectedToken = process.env.MCP_AUTH_TOKEN;

  // Check if expected token is configured
  if (!expectedToken) {
    console.error('[auth] MCP_AUTH_TOKEN not configured');
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Server authentication not configured',
      },
      id: null,
    });
    return;
  }

  // Timing-safe comparison to prevent timing attacks
  const isValid = timingSafeEqual(providedToken, expectedToken);

  if (!isValid) {
    console.warn('[auth] Invalid token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      // Never log the actual token
    });
    res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32002,
        message: 'Invalid authentication token',
      },
      id: null,
    });
    return;
  }

  // Authentication successful
  next();
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring comparison takes constant time
 */
function timingSafeEqual(provided: string, expected: string): boolean {
  // Convert strings to buffers
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  // If lengths differ, we still need to do a comparison to maintain timing consistency
  // We compare against expected buffer padded/truncated to provided length
  if (providedBuffer.length !== expectedBuffer.length) {
    // Compare provided against itself to maintain constant time, then return false
    crypto.timingSafeEqual(providedBuffer, providedBuffer);
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
