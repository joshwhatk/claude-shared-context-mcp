# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Shared Context Server - A Model Context Protocol (MCP) server that enables persistent, shared context across Claude conversations. Deployed to Railway with PostgreSQL, exposing 5 MCP tools via HTTP/SSE transport with bearer token authentication.

**Target Use Case:** Solve the limitation that Claude Projects don't natively support Claude-writable shared files across conversations.

## Technology Stack

- **Runtime:** Node.js 20+ with TypeScript (strict mode, ES2022)
- **HTTP Server:** Express (chosen over Fastify for better MCP transport examples)
- **Database:** PostgreSQL with `pg` (node-postgres) - no ORM
- **MCP SDK:** `@modelcontextprotocol/sdk` (official Anthropic SDK)
- **Testing:** Vitest with integration tests against separate test database
- **Deployment:** Railway with managed PostgreSQL
- **Auth:** Bearer token with timing-safe comparison

## Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload (tsx watch)
npm run build            # Compile TypeScript to dist/
npm start                # Run production build from dist/

# Testing
npm test                 # Run all integration tests
npm run test:watch       # Run tests in watch mode

# Database
npm run migrate          # Run migrations manually (also runs on app startup)

# Local PostgreSQL (Docker)
docker run --name mcp-postgres -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# Environment setup
cp .env.example .env     # Copy example env file
# Set DATABASE_URL and MCP_AUTH_TOKEN in .env
```

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (auto-injected by Railway)
- `MCP_AUTH_TOKEN` - Bearer token for auth (generate with `openssl rand -base64 32`)

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (info/debug)
- `TEST_DATABASE_URL` - Test database connection string

## Architecture

### High-Level Structure

```
src/
├── index.ts              # Entry point: env validation, migration, server start, graceful shutdown
├── server.ts             # MCP server initialization and configuration
├── tools/
│   ├── index.ts          # Tool registration hub
│   ├── read-context.ts   # read_context tool
│   ├── write-context.ts  # write_context tool (with validation)
│   ├── delete-context.ts # delete_context tool
│   ├── list-context.ts   # list_context tool (with search)
│   ├── read-all.ts       # read_all_context tool
│   ├── validators.ts     # Input validation (key format, content size, search sanitization)
│   └── errors.ts         # Standardized error handling (ToolError class)
├── db/
│   ├── client.ts         # PostgreSQL connection pool with SSL and retry logic
│   ├── migrations.ts     # Schema setup using PostgreSQL advisory locks
│   └── queries.ts        # Parameterized SQL queries with transaction support
├── auth/
│   └── middleware.ts     # Bearer token validation with timing-safe comparison
└── transport/
    └── http.ts           # Express HTTP/SSE transport with rate limiting and CORS
```

### Key Architectural Patterns

**1. Database Layer Isolation**
All database operations are in `src/db/queries.ts`. Tools never write SQL directly. Every query:
- Uses parameterized queries (SQL injection prevention)
- Returns typed results
- Handles "not found" gracefully
- Logs errors with context

**2. Transaction-Based Audit Trail**
`shared_context` and `context_history` tables are updated atomically using PostgreSQL transactions. Never use separate queries without transaction wrapper, as audit history must never get out of sync with main data.

**3. Migration Safety**
Migrations use PostgreSQL advisory locks to prevent race conditions when multiple Railway instances start simultaneously. The lock ID is 12345 (arbitrary but must be consistent).

**4. MCP Tool Pattern**
Each tool follows this structure:
```typescript
// 1. Validate inputs using validators.ts
// 2. Call database query from queries.ts
// 3. Return standardized response (success + data OR error via formatToolError)
// 4. All errors are ToolError instances with code and message
```

**5. Security Layers**
- **Auth middleware:** Timing-safe token comparison (prevents timing attacks)
- **Input validation:** Key format (alphanumeric + dash/underscore/dot, max 255 chars)
- **Content validation:** Max 100KB per entry
- **SQL sanitization:** Search patterns escape LIKE wildcards
- **Request logging:** Authorization headers redacted, body never logged
- **Rate limiting:** 100 requests/minute per client

## Database Schema

**Primary table:**
```sql
shared_context (
  key TEXT PRIMARY KEY CHECK(length(key) <= 255),
  content TEXT NOT NULL CHECK(length(content) <= 102400),  -- 100KB
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
INDEX: idx_shared_context_updated_at ON updated_at DESC
```

**Audit table:**
```sql
context_history (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete'
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## MCP Tools Exposed

1. **read_context(key)** - Read single context entry
2. **write_context(key, content)** - Create/update context (UPSERT)
3. **delete_context(key)** - Delete context entry
4. **list_context(limit?, search?)** - List keys with metadata (default limit: 50, max: 200)
5. **read_all_context(limit?)** - Get all entries with content (default limit: 20, max: 50)

All tools return standardized responses:
- Success: `{ success: true, data: {...}, timestamp?: string }`
- Error: `{ success: false, error: string, code: string }`

## Critical Security Requirements

**Before deploying to production, verify:**

1. ✅ **Migration advisory locks** - Implemented in `src/db/migrations.ts`
2. ✅ **SSL certificate validation** - `rejectUnauthorized: true` in `src/db/client.ts`
3. ✅ **Transaction-based audit** - All writes in `src/db/queries.ts` use transactions
4. ✅ **Timing-safe auth** - `crypto.timingSafeEqual()` in `src/auth/middleware.ts`
5. ✅ **Input validation** - All tools validate via `src/tools/validators.ts`
6. ✅ **Rate limiting** - Applied to `/mcp` endpoint in `src/transport/http.ts`
7. ✅ **Sanitized logging** - Authorization headers redacted, no body logging
8. ✅ **Environment validation** - Required vars checked in `src/index.ts`
9. ✅ **Graceful shutdown** - 30s timeout for in-flight requests
10. ✅ **CORS configuration** - Allow claude.ai origins only

## Testing Strategy

**Integration tests only** (no unit tests for v1). Tests run against separate test database.

Test setup:
```typescript
// tests/setup.ts
- Use TEST_DATABASE_URL environment variable
- Truncate tables before each test (not transaction rollback)
- Why: Test actual COMMIT behavior, not simulated transactions
```

Test coverage:
- All 5 tools with valid inputs
- Error cases (not found, invalid input, size limits)
- Audit history verification
- Search and limit parameters
- Cross-tool workflows (write → read → delete)

## Common Gotchas

**1. Don't use pool.query() directly for writes**
Always get a client from pool and use transactions:
```typescript
// WRONG
await pool.query('INSERT INTO shared_context ...');

// RIGHT
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... queries ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**2. Never disable SSL certificate validation**
`rejectUnauthorized: false` is a security vulnerability. Railway provides valid certs.

**3. Content size validation in multiple layers**
- Application validation (100KB in `validators.ts`)
- Database constraint (CHECK clause)
- Express body limit (1MB in `transport/http.ts`)

**4. Search parameters must be sanitized**
SQL LIKE wildcards (`%`, `_`, `\`) must be escaped in `list_context` search parameter to prevent SQL injection.

**5. Token comparison must be timing-safe**
Use `crypto.timingSafeEqual()`, never `===` or `!==`. Prevents timing attacks.

## Railway Deployment

**Build process:**
```bash
Build command: npm run build
Start command: npm start
Health check: /health
```

**Environment variables to set in Railway:**
- `MCP_AUTH_TOKEN` (generate: `openssl rand -base64 32`)
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `DATABASE_URL` (auto-injected by Railway PostgreSQL)

**Post-deployment verification:**
```bash
# Health check
curl https://your-app.up.railway.app/health

# Test tools list
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Claude.ai Integration

Connect via custom connector:
1. Claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://your-app.up.railway.app/mcp`
3. Auth: Add header `Authorization: Bearer YOUR_TOKEN`
4. Should see 5 tools available

Test with natural language:
- "Save to shared context with key 'test': Hello World"
- "Read the shared context for 'test'"
- "List all shared context entries"

## Planning Documents

- `mcp-shared-context-spec.md` - Original project specification
- `MEGA-PLAN.md` - Phase-by-phase implementation plan (7 phases)
- `MEGA-PLAN-REVIEW.md` - Security review with 5 critical issues and fixes

**When resuming work across conversations:**
Reference MEGA-PLAN.md phase numbers to maintain context. Each phase has checkboxes for progress tracking.

## Commit Conventions

Commit frequently with atomic changes. Use conventional commit format (feat/fix/refactor/docs/etc). Each commit should represent one logical unit that could be independently reviewed or reverted. Prefer small, descriptive commits of working code. Use conventional commit format:
- `feat: add read_context tool`
- `fix: timing attack in auth middleware`
- `security: enable SSL certificate validation`
- `refactor: extract input validators`
- `test: add integration tests for write_context`

Co-authored-by line for Claude contributions:
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```
