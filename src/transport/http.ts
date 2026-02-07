import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { server as mcpServer } from '../server.js';
import { testConnection } from '../db/client.js';
import { getUserByApiKey, hashApiKey } from '../db/queries.js';
import { setSessionContext, clearSessionContext, clearAllSessionContexts } from '../auth/session-context.js';
import { provisionClerkUser } from '../auth/provision.js';
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
      apiKeyHash?: string;
      isAdmin?: boolean;
    }
  }
}

// Constants
const MAX_BODY_SIZE = '1mb';
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup of expired rate limit entries
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [key, data] of rateLimitMap) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
      purged++;
    }
  }
  if (purged > 0 && process.env.LOG_LEVEL === 'debug') {
    console.log(`[ratelimit] Purged ${purged} expired entries from transport rate limit map`);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
rateLimitCleanupInterval.unref(); // Don't keep process alive for cleanup

// Session storage for MCP transports (API key path)
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

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
  app.post('/mcp', mcpAuthDebug, mcpAuthClerk, clerkAutoProvision, streamableHttpHandler(mcpServer));
  app.get('/mcp', mcpAuthDebug, mcpAuthClerk, streamableHttpHandler(mcpServer));
  app.delete('/mcp', mcpAuthDebug, mcpAuthClerk, streamableHttpHandler(mcpServer));

  // API key authenticated MCP endpoint for Claude Code CLI
  app.post('/claude-code/mcp', validateApiKeyHeader, rateLimiter, mcpPostHandler);
  app.get('/claude-code/mcp', validateApiKeyHeader, rateLimiter, mcpGetHandler);
  app.delete('/claude-code/mcp', validateApiKeyHeader, rateLimiter, mcpDeleteHandler);

  // Serve frontend static files in production
  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist, {
      maxAge: '1d',
      etag: true,
    }));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API, MCP, claude-code, and health routes
      if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path.startsWith('/claude-code') || req.path === '/health' || req.path.startsWith('/.well-known')) {
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
 * Debug middleware to log MCP OAuth auth state (temporary)
 */
function mcpAuthDebug(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  const tokenPrefix = token ? token.substring(0, 10) + '...' : 'none';
  console.log('[mcp-auth-debug] Incoming request:', {
    method: req.method,
    path: req.path,
    hasAuth: !!authHeader,
    tokenPrefix,
    protocol: req.protocol,
    host: req.get('host'),
  });

  // Check what clerkMiddleware() produced
  try {
    const reqAny = req as any;
    if (typeof reqAny.auth === 'function') {
      const authAny = reqAny.auth();
      console.log('[mcp-auth-debug] clerkMiddleware auth() default:', {
        isAuthenticated: authAny?.isAuthenticated,
        tokenType: authAny?.tokenType,
        userId: authAny?.userId,
      });

      const authOAuth = reqAny.auth({ acceptsToken: 'oauth_token' });
      console.log('[mcp-auth-debug] clerkMiddleware auth({ acceptsToken: oauth_token }):', {
        isAuthenticated: authOAuth?.isAuthenticated,
        tokenType: authOAuth?.tokenType,
        userId: authOAuth?.userId,
        clientId: authOAuth?.clientId,
        scopes: authOAuth?.scopes,
      });

      if (!authOAuth?.isAuthenticated && typeof authOAuth?.debug === 'function') {
        console.log('[mcp-auth-debug] auth debug info:', authOAuth.debug());
      }
    } else {
      console.log('[mcp-auth-debug] req.auth is not a function:', typeof reqAny.auth);
    }
  } catch (err) {
    console.error('[mcp-auth-debug] Error inspecting auth:', err);
  }

  next();
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

    await provisionClerkUser(auth.userId);
    next();
  } catch (error) {
    console.error('[clerk] Auto-provision error:', error);
    next();
  }
}

/**
 * Validate API key from Authorization header
 * Extracts Bearer token, validates via getUserByApiKey(), sets req properties
 */
async function validateApiKeyHeader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'API key required. Use Authorization: Bearer <api-key>',
      },
      id: null,
    });
    return;
  }

  const providedKey = authHeader.slice(7); // Strip "Bearer "

  if (!providedKey) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'API key required in Authorization header',
      },
      id: null,
    });
    return;
  }

  try {
    const userInfo = await getUserByApiKey(providedKey);

    if (!userInfo) {
      console.warn('[auth] Invalid API key in header', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Invalid API key',
        },
        id: null,
      });
      return;
    }

    // Attach user info to request for use in handlers
    req.authenticatedUserId = userInfo.userId;
    req.apiKeyHash = hashApiKey(providedKey);
    req.isAdmin = userInfo.isAdmin;

    next();
  } catch (error) {
    console.error('[auth] Error validating API key:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Authentication error',
      },
      id: null,
    });
  }
}

/**
 * Handle POST requests to /claude-code/mcp endpoint
 */
async function mcpPostHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const authenticatedUserId = req.authenticatedUserId;
  const apiKeyHash = req.apiKeyHash;
  const isAdmin = req.isAdmin ?? false;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing session
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);

          // Associate user with this session for tool handlers
          if (authenticatedUserId && apiKeyHash) {
            setSessionContext(id, {
              userId: authenticatedUserId,
              apiKeyHash: apiKeyHash,
              authenticatedAt: new Date(),
              isAdmin: isAdmin,
            });
          }

          console.log('[transport] Session initialized:', id.substring(0, 8) + '...', 'user:', authenticatedUserId, 'admin:', isAdmin);
        },
      });

      // Clean up on close
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          clearSessionContext(transport.sessionId);
          console.log('[transport] Session closed:', transport.sessionId.substring(0, 8) + '...');
        }
      };

      // Connect MCP server to this transport
      await mcpServer.connect(transport);
    } else if (!sessionId) {
      // No session ID and not an initialize request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing session ID. Send an initialize request first.',
        },
        id: null,
      });
      return;
    } else {
      // Session ID provided but not found
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or expired session',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[transport] Error handling MCP request:', error);
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
}

/**
 * Handle GET requests to /claude-code/mcp endpoint (SSE)
 */
async function mcpGetHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Invalid or missing session',
      },
      id: null,
    });
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

/**
 * Handle DELETE requests to /claude-code/mcp endpoint (session cleanup)
 */
async function mcpDeleteHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Invalid or missing session',
      },
      id: null,
    });
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
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
  } else if (origin && process.env.NODE_ENV !== 'production') {
    // Allow any origin in development only
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[cors] Allowing non-Claude origin (dev):', origin);
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
 * Simple rate limiter middleware
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

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));

  if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
    console.warn('[ratelimit] Rate limit exceeded', { clientId, count: clientData.count });
    res.status(429).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Rate limit exceeded. Please wait before making more requests.',
      },
      id: null,
    });
    return;
  }

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

/**
 * Clean up all active sessions
 */
export function cleanupSessions(): void {
  console.log(`[transport] Cleaning up ${transports.size} active sessions...`);
  for (const [sessionId, transport] of transports) {
    try {
      transport.close();
      transports.delete(sessionId);
    } catch (error) {
      console.error(`[transport] Error closing session ${sessionId}:`, error);
    }
  }
  // Clear all session contexts
  clearAllSessionContexts();

  // Stop rate limit cleanup interval
  clearInterval(rateLimitCleanupInterval);
}
