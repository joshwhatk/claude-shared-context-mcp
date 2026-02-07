/**
 * REST API router setup with Clerk JWT authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getAuth, createClerkClient } from '@clerk/express';
import { getUserByClerkId, findOrProvisionClerkUser } from '../db/queries.js';
import contextRouter from './context.js';
import adminRouter from './admin.js';

const router = Router();

// Rate limiting for API endpoints
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

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
    let user = await getUserByClerkId(clerkAuth.userId);

    if (!user) {
      // Auto-provision: Clerk invitation-only means only invited users reach here
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const clerkUser = await clerk.users.getUser(clerkAuth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkAuth.userId}@clerk.user`;
      const isAdmin = email === process.env.ADMIN_EMAIL;

      user = await findOrProvisionClerkUser(clerkAuth.userId, email, isAdmin);
      console.log('[api] Provisioned Clerk user:', email, isAdmin ? '(admin)' : '');
    }

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
    let user = await getUserByClerkId(clerkAuth.userId);

    if (!user) {
      // Auto-provision on first visit
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const clerkUser = await clerk.users.getUser(clerkAuth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkAuth.userId}@clerk.user`;
      const isAdmin = email === process.env.ADMIN_EMAIL;

      user = await findOrProvisionClerkUser(clerkAuth.userId, email, isAdmin);
      console.log('[api] Provisioned Clerk user via /auth/me:', email, isAdmin ? '(admin)' : '');
    }

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

// Apply auth and rate limiting to all /api/admin routes
router.use('/admin', rateLimiter, authMiddleware, adminRouter);

export default router;
