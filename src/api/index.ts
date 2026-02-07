/**
 * REST API router setup with Clerk JWT authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { provisionClerkUser } from '../auth/provision.js';
import contextRouter from './context.js';
import adminRouter from './admin.js';
import keysRouter from './keys.js';

const router = Router();

// Rate limiting for API endpoints
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup of expired rate limit entries
const apiRateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [key, data] of rateLimitMap) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
      purged++;
    }
  }
  if (purged > 0 && process.env.LOG_LEVEL === 'debug') {
    console.log(`[ratelimit] Purged ${purged} expired entries from API rate limit map`);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
apiRateLimitCleanupInterval.unref(); // Don't keep process alive for cleanup

/**
 * Authentication middleware for REST API using Clerk JWT
 * Validates Clerk session and auto-provisions users
 */
async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const clerkAuth = getAuth(req);

  if (!clerkAuth?.userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const user = await provisionClerkUser(clerkAuth.userId);

    // Attach user info to request
    req.authenticatedUserId = user.id;
    req.isAdmin = user.is_admin;

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
 * GET /api/auth/me
 * Get current authenticated user info from Clerk session
 */
router.get('/auth/me', rateLimiter, async (req: Request, res: Response): Promise<void> => {
  const clerkAuth = getAuth(req);

  if (!clerkAuth?.userId) {
    res.status(401).json({
      success: false,
      error: 'Not authenticated',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const user = await provisionClerkUser(clerkAuth.userId);

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        isAdmin: user.is_admin,
        authenticated: true,
      },
    });
  } catch (error) {
    console.error('[api] Auth/me error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Apply auth and rate limiting to all /api/context routes
router.use('/context', rateLimiter, authMiddleware, contextRouter);

// Apply auth and rate limiting to all /api/keys routes (self-service)
router.use('/keys', rateLimiter, authMiddleware, keysRouter);

// Apply auth and rate limiting to all /api/admin routes
router.use('/admin', rateLimiter, authMiddleware, adminRouter);

export default router;
