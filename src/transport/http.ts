import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { server as mcpServer } from '../server.js';
import { testConnection } from '../db/client.js';
import { getUserByClerkId, createClerkUser } from '../db/queries.js';
import { registerAllTools } from '../tools/index.js';
import apiRouter from '../api/index.js';
import { clerkMiddleware, getAuth } from '@clerk/express';
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from '@clerk/mcp-tools/express';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Express Request to include authenticated user info
declare global {
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
      isAdmin?: boolean;
    }
  }
}

// Constants
const MAX_BODY_SIZE = '1mb';

/**
 * Create and configure the Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy for accurate IP detection behind Railway
  app.set('trust proxy', 1);

  // Body parsing with size limit
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  // Clerk middleware (global, must be before routes)
  app.use(clerkMiddleware());

  // Request logging middleware (sanitized)
  app.use(requestLogger);

  // CORS configuration for Claude.ai
  app.use(corsMiddleware);

  // REST API routes (before static files, after CORS)
  app.use('/api', apiRouter);

  // Health check endpoint (no auth required)
  app.get('/health', healthCheckHandler);

  // Well-known OAuth metadata endpoints (public, no auth)
  app.get('/.well-known/oauth-protected-resource', protectedResourceHandlerClerk());
  app.get('/.well-known/oauth-authorization-server', authServerMetadataHandlerClerk);

  // Clerk OAuth-protected MCP endpoint
  app.post('/mcp', mcpAuthClerk, clerkAutoProvision, streamableHttpHandler(mcpServer));
  app.get('/mcp', mcpAuthClerk, streamableHttpHandler(mcpServer));
  app.delete('/mcp', mcpAuthClerk, streamableHttpHandler(mcpServer));

  // Serve frontend static files in production
  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist, {
      maxAge: '1d',
      etag: true,
    }));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API, MCP, and health routes
      if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path === '/health' || req.path.startsWith('/.well-known')) {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

/**
 * Middleware to auto-provision Clerk users in our database on first MCP auth
 */
async function clerkAutoProvision(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return next();
    }

    const clerkId = auth.userId;
    const existingUser = await getUserByClerkId(clerkId);

    if (!existingUser) {
      // Auto-provision: look up email from Clerk
      const { createClerkClient } = await import('@clerk/express');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const clerkUser = await clerk.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkId}@clerk.user`;
      const isAdmin = email === process.env.ADMIN_EMAIL;

      await createClerkUser(clerkId, email, isAdmin);
      console.log('[clerk] Auto-provisioned user:', email, isAdmin ? '(admin)' : '');
    }

    next();
  } catch (error) {
    console.error('[clerk] Auto-provision error:', error);
    next();
  }
}

/**
 * Health check endpoint handler
 */
async function healthCheckHandler(_req: Request, res: Response): Promise<void> {
  try {
    await testConnection(1, 0); // Single attempt, no delay
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (error) {
    console.error('[health] Database connection failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
}

/**
 * CORS middleware for Claude.ai access
 */
function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow requests from Claude.ai/Claude.com origins
  const allowedOrigins = [
    'https://claude.ai',
    'https://www.claude.ai',
    'https://claude.com',
    'https://www.claude.com',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // For development/testing, allow any origin but log it
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[cors] Allowing non-Claude origin:', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, WWW-Authenticate');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * Request logging middleware (sanitized - no auth headers or body)
 */
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    const logFn = logLevel === 'warn' ? console.warn : console.log;
    logFn('[http]', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      // Authorization header and body are intentionally NOT logged
    });
  });

  next();
}

/**
 * Error handling middleware
 */
function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[http] Unhandled error:', err);

  if (!res.headersSent) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
      },
      id: null,
    });
  }
}

/**
 * Initialize the HTTP server
 * Must be called after tools are registered
 */
export function initializeServer(): express.Application {
  // Register all MCP tools before creating the app
  registerAllTools();

  return createApp();
}
