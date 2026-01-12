import express, { Request, Response, NextFunction } from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { server as mcpServer } from '../server.js';
import { validateAuth } from '../auth/middleware.js';
import { testConnection } from '../db/client.js';
import { registerAllTools } from '../tools/index.js';

// Constants
const MAX_BODY_SIZE = '1mb';
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Create and configure the Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy for accurate IP detection behind Railway
  app.set('trust proxy', 1);

  // Body parsing with size limit
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  // Request logging middleware (sanitized)
  app.use(requestLogger);

  // CORS configuration for Claude.ai
  app.use(corsMiddleware);

  // Health check endpoint (no auth required)
  app.get('/health', healthCheckHandler);

  // MCP endpoint with rate limiting and origin verification
  // Auth is handled via secret URL path: /mcp/:apiKey
  // This works with Claude.ai which doesn't support Bearer tokens
  app.post('/mcp', verifyClaudeOrigin, rateLimiter, mcpPostHandler);
  app.get('/mcp', verifyClaudeOrigin, mcpGetHandler);
  app.delete('/mcp', verifyClaudeOrigin, mcpDeleteHandler);

  // Secret URL path authentication (recommended for Claude.ai)
  // URL format: /mcp/<your-api-key>
  app.post('/mcp/:apiKey', validateApiKeyParam, rateLimiter, mcpPostHandler);
  app.get('/mcp/:apiKey', validateApiKeyParam, mcpGetHandler);
  app.delete('/mcp/:apiKey', validateApiKeyParam, mcpDeleteHandler);

  // Legacy Bearer token auth (for backward compatibility with curl/scripts)
  app.post('/mcp/auth', validateAuth, rateLimiter, mcpPostHandler);
  app.get('/mcp/auth', validateAuth, mcpGetHandler);
  app.delete('/mcp/auth', validateAuth, mcpDeleteHandler);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

// Session storage for MCP transports
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

/**
 * Handle POST requests to /mcp endpoint
 */
async function mcpPostHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

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
          console.log('[transport] Session initialized:', id);
        },
      });

      // Clean up on close
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.log('[transport] Session closed:', transport.sessionId);
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
 * Handle GET requests to /mcp endpoint (SSE)
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
 * Handle DELETE requests to /mcp endpoint (session cleanup)
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
  } else if (origin) {
    // For development/testing, allow any origin but log it
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[cors] Allowing non-Claude origin:', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
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
 * Verify request comes from Claude.ai
 * Checks Origin header - not foolproof but adds a security layer
 */
function verifyClaudeOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Allowed Claude origins
  const allowedOrigins = [
    'https://claude.ai',
    'https://www.claude.ai',
    'https://claude.com',
    'https://www.claude.com',
  ];

  // Check if origin or referer matches Claude
  const isFromClaude =
    (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed))) ||
    (referer && allowedOrigins.some((allowed) => referer.startsWith(allowed)));

  // In production, require Claude origin (unless explicitly disabled)
  const isProduction = process.env.NODE_ENV === 'production';
  const skipOriginCheck = process.env.SKIP_ORIGIN_CHECK === 'true';

  if (isProduction && !skipOriginCheck && !isFromClaude) {
    console.warn('[auth] Request rejected - not from Claude origin', {
      origin,
      referer,
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32002,
        message: 'Access denied. This endpoint only accepts requests from Claude.ai',
      },
      id: null,
    });
    return;
  }

  next();
}

/**
 * Validate API key from URL path parameter
 * Uses timing-safe comparison to prevent timing attacks
 */
function validateApiKeyParam(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.params.apiKey;
  const expectedKey = process.env.MCP_AUTH_TOKEN;

  if (!expectedKey) {
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

  if (!providedKey) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'API key required in URL path',
      },
      id: null,
    });
    return;
  }

  // Timing-safe comparison
  const providedBuffer = Buffer.from(providedKey, 'utf8');
  const expectedBuffer = Buffer.from(expectedKey, 'utf8');

  let isValid = false;
  if (providedBuffer.length === expectedBuffer.length) {
    isValid = timingSafeEqual(providedBuffer, expectedBuffer);
  } else {
    // Compare against itself to maintain constant time
    timingSafeEqual(providedBuffer, providedBuffer);
  }

  if (!isValid) {
    console.warn('[auth] Invalid API key in URL', {
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
    // Reset or initialize
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
}
