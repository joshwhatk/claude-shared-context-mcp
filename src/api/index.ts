/**
 * REST API router setup with authentication middleware
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getUserByApiKey, hashApiKey, getUserById } from '../db/queries.js';
import contextRouter from './context.js';

const router = Router();

// Rate limiting for API endpoints (separate from MCP rate limiter)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Extract API key from Authorization header
 * Expects: "Bearer <api-key>"
 */
function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authentication middleware for REST API
 * Validates Bearer token and attaches user info to request
 */
async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = extractApiKey(req.headers.authorization);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide API key in Authorization header.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const userInfo = await getUserByApiKey(apiKey);

    if (!userInfo) {
      res.status(403).json({
        success: false,
        error: 'Invalid API key',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Attach user info to request
    req.authenticatedUserId = userInfo.userId;
    req.apiKeyHash = hashApiKey(apiKey);
    req.isAdmin = userInfo.isAdmin;

    next();
  } catch (error) {
    console.error('[api] Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Rate limiter middleware for API endpoints
 */
function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.ip || 'unknown';
  const now = Date.now();

  let clientData = rateLimitMap.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    clientData = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(clientId, clientData);
  } else {
    clientData.count++;
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));

  if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please wait before making more requests.',
      code: 'RATE_LIMITED',
    });
    return;
  }

  next();
}

/**
 * POST /api/auth/verify
 * Verify API key and return user info
 */
router.post('/auth/verify', rateLimiter, async (req: Request, res: Response): Promise<void> => {
  const apiKey = extractApiKey(req.headers.authorization);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required in Authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const userInfo = await getUserByApiKey(apiKey);

    if (!userInfo) {
      res.status(403).json({
        success: false,
        error: 'Invalid API key',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Get user details
    const user = await getUserById(userInfo.userId);

    res.json({
      success: true,
      data: {
        userId: userInfo.userId,
        email: user?.email || null,
        isAdmin: userInfo.isAdmin,
        authenticated: true,
      },
    });
  } catch (error) {
    console.error('[api] Verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Apply auth and rate limiting to all /api/context routes
router.use('/context', rateLimiter, authMiddleware, contextRouter);

export default router;
